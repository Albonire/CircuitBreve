import type {
  CircuitGraph, CircuitLayout, LayoutNode, Wire,
  WireSegment, PinPosition, CircuitNodeKind
} from '@/types';
import type { DimensionConfig } from '@/components/DimensionsPanel';

// Minimum sizes to preserve visual integrity
const MIN_GATE_W = 70;
const MIN_GATE_H = 36;
const MIN_IO_W = 56;
const MIN_IO_H = 28;

const DEFAULT_CONFIG: DimensionConfig = {
  layerGap: 140,
  nodeGap: 60,
  padding: 50,
  gateWidth: 72,
  gateHeight: 44,
  inputWidth: 68,
  inputHeight: 36,
  outputWidth: 68,
  outputHeight: 36,
  nodeOverrides: new Map(),
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getNodeDimensions(
  label: string,
  kind: CircuitNodeKind,
  config: DimensionConfig,
  nodeId: string
): { width: number; height: number } {
  const override = config.nodeOverrides.get(nodeId);
  if (override) {
    if (kind === 'gate') {
      return {
        width: clamp(override.width, MIN_GATE_W, 300),
        height: clamp(override.height, MIN_GATE_H, 150),
      };
    }
    return {
      width: clamp(override.width, MIN_IO_W, 300),
      height: clamp(override.height, MIN_IO_H, 120),
    };
  }

  switch (kind) {
    case 'input':
      return {
        width: Math.max(clamp(config.inputWidth, MIN_IO_W, 300), label.length * 9 + 40),
        height: clamp(config.inputHeight, MIN_IO_H, 120),
      };
    case 'output':
      return {
        width: Math.max(clamp(config.outputWidth, MIN_IO_W, 300), label.length * 9 + 40),
        height: clamp(config.outputHeight, MIN_IO_H, 120),
      };
    case 'gate':
    default:
      return {
        width: Math.max(clamp(config.gateWidth, MIN_GATE_W, 300), label.length * 8 + 36),
        height: clamp(config.gateHeight, MIN_GATE_H, 150),
      };
  }
}

// ── Step 1: Layers via longest path ──
function assignLayers(graph: CircuitGraph): Map<string, number> {
  const layers = new Map<string, number>();
  const visiting = new Set<string>();

  function dfs(nodeId: string): number {
    if (layers.has(nodeId)) return layers.get(nodeId)!;
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node || node.inputs.length === 0) {
      layers.set(nodeId, 0);
      visiting.delete(nodeId);
      return 0;
    }

    let maxDepth = 0;
    for (const inputId of node.inputs) {
      maxDepth = Math.max(maxDepth, dfs(inputId) + 1);
    }

    layers.set(nodeId, maxDepth);
    visiting.delete(nodeId);
    return maxDepth;
  }

  for (const id of graph.nodes.keys()) dfs(id);
  return layers;
}

// ── Step 2: Group by layer ──
function groupByLayer(graph: CircuitGraph, layers: Map<string, number>): string[][] {
  const maxLayer = Math.max(...Array.from(layers.values()), 0);
  const groups: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const [id] of graph.nodes) {
    groups[layers.get(id) ?? 0].push(id);
  }
  return groups;
}

// ── Step 3: Crossing minimization (Barycenter) ──
function minimizeCrossings(layerGroups: string[][], graph: CircuitGraph): string[][] {
  const result = layerGroups.map(l => [...l]);

  for (let sweep = 0; sweep < 6; sweep++) {
    // Forward
    for (let i = 1; i < result.length; i++) {
      const prevPos = new Map<string, number>();
      result[i - 1].forEach((id, idx) => prevPos.set(id, idx));

      const scored = result[i].map(nodeId => {
        const node = graph.nodes.get(nodeId);
        if (!node || node.inputs.length === 0) return { id: nodeId, bc: Infinity };
        const positions = node.inputs
          .map(id => prevPos.get(id))
          .filter((p): p is number => p !== undefined);
        if (positions.length === 0) return { id: nodeId, bc: Infinity };
        return { id: nodeId, bc: positions.reduce((a, b) => a + b, 0) / positions.length };
      });
      scored.sort((a, b) => a.bc - b.bc);
      result[i] = scored.map(s => s.id);
    }
    // Backward
    for (let i = result.length - 2; i >= 0; i--) {
      const nextPos = new Map<string, number>();
      result[i + 1].forEach((id, idx) => nextPos.set(id, idx));

      const scored = result[i].map(nodeId => {
        const node = graph.nodes.get(nodeId);
        if (!node || node.outputs.length === 0) return { id: nodeId, bc: Infinity };
        const positions = node.outputs
          .map(id => nextPos.get(id))
          .filter((p): p is number => p !== undefined);
        if (positions.length === 0) return { id: nodeId, bc: Infinity };
        return { id: nodeId, bc: positions.reduce((a, b) => a + b, 0) / positions.length };
      });
      scored.sort((a, b) => a.bc - b.bc);
      result[i] = scored.map(s => s.id);
    }
  }

  return result;
}

function gateInputBoundaryX(gateType: string | undefined, width: number, yInNode: number, height: number): number {
  if (!gateType) return 0;

  const f = height <= 0 ? 0.5 : clamp(yInNode / height, 0, 1);

  // OR-family gates have a concave left side. Put the pin on that curve,
  // not on the bounding-box edge, otherwise wires look visually detached.
  if (gateType === 'OR' || gateType === 'NOR') {
    return width * 0.4 * f * (1 - f);
  }

  // XOR-family gates have the same concave side shifted slightly right.
  if (gateType === 'XOR' || gateType === 'XNOR') {
    return width * (0.08 + 0.4 * f * (1 - f));
  }

  return 0;
}

// ── Step 4: Coordinates ──
// Pins are placed on the actual visible gate boundary, not just the bbox.
function assignCoordinates(
  layerGroups: string[][],
  graph: CircuitGraph,
  config: DimensionConfig
): LayoutNode[] {
  const layoutNodes: LayoutNode[] = [];

  for (let layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
    const layer = layerGroups[layerIdx];
    const x = config.padding + layerIdx * config.layerGap;
    let y = config.padding;

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const nodeId = layer[nodeIdx];
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      const { width, height } = getNodeDimensions(node.label, node.kind, config, nodeId);

      // Input pins sit exactly on the LEFT edge of the bounding box
      const inputPins: PinPosition[] = [];
      const numInputs = node.inputs.length;
      for (let i = 0; i < numInputs; i++) {
        const pinY = numInputs === 1
          ? y + height / 2
          : y + height * (i + 1) / (numInputs + 1);
        const localY = pinY - y;
        const pinX = node.kind === 'gate'
          ? x + gateInputBoundaryX(node.gateType, width, localY, height)
          : x;
        inputPins.push({ x: pinX, y: pinY, label: `in${i}`, nodeId });
      }

      // Output pin sits exactly on the RIGHT edge
      const outputPins: PinPosition[] = [{
        x: x + width,
        y: y + height / 2,
        label: 'out',
        nodeId,
      }];

      layoutNodes.push({
        id: nodeId, x, y, width, height,
        layer: layerIdx,
        label: node.label,
        kind: node.kind,
        gateType: node.gateType,
        inputPins,
        outputPins,
      });

      y += height + config.nodeGap;
    }
  }

  return layoutNodes;
}

// ── Step 5: Wire routing ──
// Orthogonal routing that never cuts through node bodies.
// We route wires through the midpoint between layers, which is always clear.
function routeWires(layoutNodes: LayoutNode[], graph: CircuitGraph, _config: DimensionConfig): Wire[] {
  const wires: Wire[] = [];
  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of layoutNodes) nodeMap.set(ln.id, ln);

  // Compute channel X positions (halfway between layers)
  // Group nodes by layer to find the right edge of each layer
  const layerRightEdge = new Map<number, number>();
  const layerLeftEdge = new Map<number, number>();
  for (const ln of layoutNodes) {
    const right = ln.x + ln.width;
    const left = ln.x;
    layerRightEdge.set(ln.layer, Math.max(layerRightEdge.get(ln.layer) ?? 0, right));
    layerLeftEdge.set(ln.layer, Math.min(layerLeftEdge.get(ln.layer) ?? Infinity, left));
  }

  // Track how many wires share each channel to offset them slightly
  const channelUsage = new Map<string, number>();

  for (const layoutNode of layoutNodes) {
    const circuitNode = graph.nodes.get(layoutNode.id);
    if (!circuitNode) continue;

    for (let i = 0; i < circuitNode.inputs.length; i++) {
      const srcId = circuitNode.inputs[i];
      const srcLayout = nodeMap.get(srcId);
      if (!srcLayout) continue;

      const fromPin = srcLayout.outputPins[0];
      const toPin = layoutNode.inputPins[i] ?? layoutNode.inputPins[0];
      if (!fromPin || !toPin) continue;

      const segments: WireSegment[] = [];

      if (Math.abs(fromPin.y - toPin.y) < 1.5 && srcLayout.layer + 1 === layoutNode.layer) {
        // Straight horizontal — same Y, adjacent layers
        segments.push({ x1: fromPin.x, y1: fromPin.y, x2: toPin.x, y2: toPin.y });
      } else {
        // Orthogonal 3-segment route through channel between layers
        const srcRight = layerRightEdge.get(srcLayout.layer) ?? fromPin.x;
        const dstLeft = layerLeftEdge.get(layoutNode.layer) ?? toPin.x;
        const channelX = (srcRight + dstLeft) / 2;

        // Offset within channel to avoid overlapping wires
        const channelKey = `${srcLayout.layer}-${layoutNode.layer}`;
        const usage = channelUsage.get(channelKey) ?? 0;
        channelUsage.set(channelKey, usage + 1);
        const offset = (usage - 2) * 6;

        const midX = channelX + offset;

        segments.push({ x1: fromPin.x, y1: fromPin.y, x2: midX, y2: fromPin.y });
        segments.push({ x1: midX, y1: fromPin.y, x2: midX, y2: toPin.y });
        segments.push({ x1: midX, y1: toPin.y, x2: toPin.x, y2: toPin.y });
      }

      wires.push({
        id: `w_${srcId}_${layoutNode.id}_${i}`,
        fromNodeId: srcId,
        toNodeId: layoutNode.id,
        fromPin,
        toPin,
        segments,
      });
    }
  }

  return wires;
}

export function computeLayout(
  graph: CircuitGraph,
  config?: DimensionConfig
): CircuitLayout {
  const cfg = config ?? DEFAULT_CONFIG;

  if (graph.nodes.size === 0) {
    return { nodes: [], wires: [], width: 400, height: 300 };
  }

  const layers = assignLayers(graph);
  const layerGroups = groupByLayer(graph, layers);
  const optimizedGroups = minimizeCrossings(layerGroups, graph);
  const layoutNodes = assignCoordinates(optimizedGroups, graph, cfg);
  const wires = routeWires(layoutNodes, graph, cfg);

  let maxX = 0;
  let maxY = 0;
  for (const node of layoutNodes) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return {
    nodes: layoutNodes,
    wires,
    width: maxX + cfg.padding * 2,
    height: maxY + cfg.padding * 2,
  };
}
