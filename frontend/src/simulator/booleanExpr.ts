// ============================================================
// LogicSVG Pro — Boolean Expression Extractor
// ============================================================
import type { CircuitGraph } from '@/types';

export interface BooleanExpression {
  outputName: string;
  expression: string;
}

function buildExpression(
  nodeId: string,
  graph: CircuitGraph,
  visited: Set<string>,
  depth: number
): string {
  if (depth > 30) return '…';
  if (visited.has(nodeId)) return '?';
  visited.add(nodeId);

  const node = graph.nodes.get(nodeId);
  if (!node) return '?';

  if (node.kind === 'input') {
    return node.label;
  }

  if (node.kind === 'output') {
    if (node.inputs.length > 0) {
      return buildExpression(node.inputs[0], graph, visited, depth + 1);
    }
    return node.label;
  }

  if (node.kind === 'gate' && node.gateType) {
    const args = node.inputs.map(id =>
      buildExpression(id, graph, new Set(visited), depth + 1)
    );

    switch (node.gateType) {
      case 'NOT':
        return args.length === 1 ? `¬${wrapIfComplex(args[0])}` : `NOT(${args.join(', ')})`;
      case 'AND':
        return args.join(' · ');
      case 'OR':
        return args.map(a => wrapIfOr(a)).join(' + ');
      case 'NAND':
        return `¬(${args.join(' · ')})`;
      case 'NOR':
        return `¬(${args.join(' + ')})`;
      case 'XOR':
        return args.join(' ⊕ ');
      case 'XNOR':
        return `¬(${args.join(' ⊕ ')})`;
      case 'BUF':
        return args[0] ?? '?';
      default:
        return `${node.gateType}(${args.join(', ')})`;
    }
  }

  return node.label;
}

function wrapIfComplex(expr: string): string {
  if (expr.includes(' ') && !expr.startsWith('¬') && !expr.startsWith('(')) {
    return `(${expr})`;
  }
  return expr;
}

function wrapIfOr(expr: string): string {
  // Wrap AND expressions so precedence is clear in OR context
  if (expr.includes(' · ') && !expr.startsWith('(') && !expr.startsWith('¬(')) {
    return `(${expr})`;
  }
  return expr;
}

export function extractBooleanExpressions(graph: CircuitGraph): BooleanExpression[] {
  const results: BooleanExpression[] = [];

  for (const outputId of graph.outputIds) {
    const node = graph.nodes.get(outputId);
    if (!node) continue;

    const expr = buildExpression(outputId, graph, new Set(), 0);
    results.push({
      outputName: node.label,
      expression: expr,
    });
  }

  return results;
}

// Gate count breakdown
export interface GateCount {
  type: string;
  count: number;
}

export function countGates(graph: CircuitGraph): GateCount[] {
  const counts = new Map<string, number>();

  for (const node of graph.nodes.values()) {
    if (node.kind === 'gate' && node.gateType) {
      counts.set(node.gateType, (counts.get(node.gateType) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
