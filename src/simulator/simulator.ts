// ============================================================
// LogicSVG Pro — Circuit Simulator
// ============================================================
import type { CircuitGraph, SimulationState, LogicValue, TruthTable, TruthTableRow, Diagnostic } from '@/types';

// Topological sort using Kahn's algorithm
function topologicalSort(graph: CircuitGraph): { order: string[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const [id, node] of graph.nodes) {
    inDegree.set(id, node.inputs.length);
    if (!adjList.has(id)) adjList.set(id, []);
    for (const outId of node.outputs) {
      const list = adjList.get(id);
      if (list) list.push(outId);
      else adjList.set(id, [outId]);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);

    const neighbors = adjList.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  if (order.length !== graph.nodes.size) {
    diagnostics.push({
      severity: 'warning',
      message: `Cycle detected in circuit (processed ${order.length}/${graph.nodes.size} nodes)`,
      line: 0,
      col: 0,
    });

    // Add remaining nodes anyway
    for (const id of graph.nodes.keys()) {
      if (!order.includes(id)) {
        order.push(id);
      }
    }
  }

  return { order, diagnostics };
}

function evaluateGate(gateType: string, inputs: LogicValue[]): LogicValue {
  switch (gateType) {
    case 'AND':
      return inputs.every(v => v);
    case 'OR':
      return inputs.some(v => v);
    case 'NOT':
      return !inputs[0];
    case 'BUF':
      return inputs[0] ?? false;
    case 'NAND':
      return !inputs.every(v => v);
    case 'NOR':
      return !inputs.some(v => v);
    case 'XOR':
      return inputs.reduce((a, b) => a !== b, false);
    case 'XNOR':
      return !inputs.reduce((a, b) => a !== b, false);
    case 'DFF':
    case 'JKFF':
    case 'TFF':
      // Simplified flip-flop: pass through D input for now
      return inputs[0] ?? false;
    default:
      return false;
  }
}

export function simulate(
  graph: CircuitGraph,
  inputValues: Map<string, LogicValue>
): { state: SimulationState; diagnostics: Diagnostic[] } {
  const { order, diagnostics } = topologicalSort(graph);
  const values = new Map<string, LogicValue>();

  // Set input values
  for (const inputId of graph.inputIds) {
    const node = graph.nodes.get(inputId);
    if (node) {
      const val = inputValues.get(inputId) ?? false;
      values.set(inputId, val);
    }
  }

  // Evaluate in topological order
  for (const nodeId of order) {
    if (values.has(nodeId)) continue; // Already set (inputs)

    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    if (node.kind === 'gate' && node.gateType) {
      const inputVals = node.inputs.map(id => values.get(id) ?? false);
      values.set(nodeId, evaluateGate(node.gateType, inputVals));
    } else if (node.kind === 'output') {
      // Output passes through its single input
      const inputVal = node.inputs.length > 0 ? (values.get(node.inputs[0]) ?? false) : false;
      values.set(nodeId, inputVal);
    } else {
      values.set(nodeId, false);
    }
  }

  return {
    state: { values, evaluationOrder: order },
    diagnostics,
  };
}

export function generateTruthTable(graph: CircuitGraph): TruthTable {
  const inputIds = graph.inputIds;
  const outputIds = graph.outputIds;
  const inputNames: string[] = [];
  const outputNames: string[] = [];

  for (const id of inputIds) {
    const node = graph.nodes.get(id);
    if (node) inputNames.push(node.label);
  }
  for (const id of outputIds) {
    const node = graph.nodes.get(id);
    if (node) outputNames.push(node.label);
  }

  const numInputs = inputIds.length;
  const totalRows = Math.pow(2, numInputs);
  const rows: TruthTableRow[] = [];

  // Limit to 256 rows for performance
  const maxRows = Math.min(totalRows, 256);

  for (let i = 0; i < maxRows; i++) {
    const inputVals = new Map<string, LogicValue>();
    const inputDisplay = new Map<string, boolean>();

    for (let j = 0; j < numInputs; j++) {
      const val = Boolean((i >> (numInputs - 1 - j)) & 1);
      inputVals.set(inputIds[j], val);
      inputDisplay.set(inputNames[j], val);
    }

    const { state } = simulate(graph, inputVals);

    const outputDisplay = new Map<string, boolean>();
    for (let j = 0; j < outputIds.length; j++) {
      outputDisplay.set(outputNames[j], state.values.get(outputIds[j]) ?? false);
    }

    rows.push({ inputs: inputDisplay, outputs: outputDisplay });
  }

  return { inputNames, outputNames, rows };
}

export function exportTruthTableCSV(table: TruthTable): string {
  const headers = [...table.inputNames, ...table.outputNames];
  const lines = [headers.join(',')];

  for (const row of table.rows) {
    const vals: string[] = [];
    for (const name of table.inputNames) {
      vals.push(row.inputs.get(name) ? '1' : '0');
    }
    for (const name of table.outputNames) {
      vals.push(row.outputs.get(name) ? '1' : '0');
    }
    lines.push(vals.join(','));
  }

  return lines.join('\n');
}
