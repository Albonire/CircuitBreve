// ============================================================
// LogicSVG Pro — Graph Builder (Flatten modules → CircuitGraph)
// ============================================================
import type {
  ParsedCircuit, CircuitGraph, CircuitNode,
  Statement, ASTExpression, ModuleDefinition, Diagnostic
} from '@/types';

interface BuildContext {
  graph: CircuitGraph;
  modules: Map<string, ModuleDefinition>;
  nameMap: Map<string, string>; // local name → node ID
  diagnostics: Diagnostic[];
  counter: number;
  prefix: string;
}

function newId(ctx: BuildContext, hint: string): string {
  ctx.counter++;
  const id = ctx.prefix ? `${ctx.prefix}_${hint}_${ctx.counter}` : `${hint}_${ctx.counter}`;
  return id;
}

function resolveExpression(ctx: BuildContext, expr: ASTExpression): string {
  if (expr.kind === 'identifier') {
    const name = expr.name ?? '__error__';
    const resolved = ctx.nameMap.get(name);
    if (!resolved) {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Undefined signal '${name}'`,
        line: expr.line,
        col: expr.col,
      });
      // Create a phantom input
      const id = newId(ctx, name);
      const node: CircuitNode = {
        id,
        kind: 'input',
        label: name,
        inputs: [],
        outputs: [],
      };
      ctx.graph.nodes.set(id, node);
      ctx.nameMap.set(name, id);
      return id;
    }
    return resolved;
  }

  if (expr.kind === 'gate_call' && expr.gateType && expr.args) {
    const gateType = expr.gateType;
    const inputIds = expr.args.map(arg => resolveExpression(ctx, arg));
    const id = newId(ctx, gateType);

    const node: CircuitNode = {
      id,
      kind: 'gate',
      gateType,
      label: gateType,
      inputs: [...inputIds],
      outputs: [],
    };
    ctx.graph.nodes.set(id, node);

    // Link outputs from source nodes
    for (const srcId of inputIds) {
      const srcNode = ctx.graph.nodes.get(srcId);
      if (srcNode) {
        srcNode.outputs.push(id);
      }
    }

    return id;
  }

  return '__error__';
}

function processStatement(ctx: BuildContext, stmt: Statement): void {
  switch (stmt.kind) {
    case 'input': {
      for (const name of stmt.names) {
        const id = newId(ctx, name);
        const node: CircuitNode = {
          id,
          kind: 'input',
          label: name,
          inputs: [],
          outputs: [],
        };
        ctx.graph.nodes.set(id, node);
        ctx.graph.inputIds.push(id);
        ctx.nameMap.set(name, id);
      }
      break;
    }

    case 'output': {
      if (stmt.expression) {
        // OUTPUT X = EXPR
        const srcId = resolveExpression(ctx, stmt.expression);
        const id = newId(ctx, stmt.name);
        const node: CircuitNode = {
          id,
          kind: 'output',
          label: stmt.name,
          inputs: [srcId],
          outputs: [],
        };
        ctx.graph.nodes.set(id, node);
        ctx.graph.outputIds.push(id);
        ctx.nameMap.set(stmt.name, id);

        const srcNode = ctx.graph.nodes.get(srcId);
        if (srcNode) srcNode.outputs.push(id);
      } else {
        // OUTPUT X (where X is already defined)
        const resolved = ctx.nameMap.get(stmt.name);
        if (resolved) {
          const id = newId(ctx, `out_${stmt.name}`);
          const node: CircuitNode = {
            id,
            kind: 'output',
            label: stmt.name,
            inputs: [resolved],
            outputs: [],
          };
          ctx.graph.nodes.set(id, node);
          ctx.graph.outputIds.push(id);

          const srcNode = ctx.graph.nodes.get(resolved);
          if (srcNode) srcNode.outputs.push(id);
        } else {
          ctx.diagnostics.push({
            severity: 'error',
            message: `OUTPUT references undefined signal '${stmt.name}'`,
            line: stmt.line,
            col: stmt.col,
          });
        }
      }
      break;
    }

    case 'gate': {
      const srcId = resolveExpression(ctx, stmt.expression);
      // Rename the resulting node to the target name
      ctx.nameMap.set(stmt.target, srcId);
      // Also update the node's label
      const node = ctx.graph.nodes.get(srcId);
      if (node && node.kind === 'gate') {
        // Keep gate label as gate type, but store target
        // We just map the name to the existing gate node
      }
      break;
    }

    case 'module_inst': {
      const moduleDef = ctx.modules.get(stmt.moduleName);
      if (!moduleDef) {
        ctx.diagnostics.push({
          severity: 'error',
          message: `Undefined module '${stmt.moduleName}'`,
          line: stmt.line,
          col: stmt.col,
        });
        return;
      }

      // Resolve arguments
      const argIds = stmt.args.map(arg => resolveExpression(ctx, arg));

      // Create a sub-context for the module
      const subPrefix = ctx.prefix ? `${ctx.prefix}_${stmt.moduleName}` : stmt.moduleName;
      const subCtx: BuildContext = {
        graph: ctx.graph,
        modules: ctx.modules,
        nameMap: new Map(),
        diagnostics: ctx.diagnostics,
        counter: ctx.counter,
        prefix: subPrefix + '_' + ctx.counter,
      };

      // Map module inputs to argument IDs
      for (let i = 0; i < moduleDef.inputs.length; i++) {
        if (i < argIds.length) {
          subCtx.nameMap.set(moduleDef.inputs[i], argIds[i]);
        }
      }

      // Process module body
      for (const bodyStmt of moduleDef.body) {
        processStatement(subCtx, bodyStmt);
      }

      ctx.counter = subCtx.counter;

      // Map module outputs to the caller's output names
      for (let i = 0; i < stmt.outputs.length; i++) {
        if (i < moduleDef.outputs.length) {
          const outputName = moduleDef.outputs[i];
          const resolvedId = subCtx.nameMap.get(outputName);
          if (resolvedId) {
            ctx.nameMap.set(stmt.outputs[i], resolvedId);
          }
        }
      }
      break;
    }
  }
}

export function buildGraph(parsed: ParsedCircuit): { graph: CircuitGraph; diagnostics: Diagnostic[] } {
  const graph: CircuitGraph = {
    nodes: new Map(),
    inputIds: [],
    outputIds: [],
  };

  const modules = new Map<string, ModuleDefinition>();
  for (const mod of parsed.modules) {
    modules.set(mod.name, mod);
  }

  const ctx: BuildContext = {
    graph,
    modules,
    nameMap: new Map(),
    diagnostics: [],
    counter: 0,
    prefix: '',
  };

  for (const stmt of parsed.statements) {
    processStatement(ctx, stmt);
  }

  // Warn if no outputs
  if (graph.outputIds.length === 0) {
    ctx.diagnostics.push({
      severity: 'warning',
      message: 'Circuit has no outputs defined',
      line: 0,
      col: 0,
    });
  }

  return { graph, diagnostics: ctx.diagnostics };
}
