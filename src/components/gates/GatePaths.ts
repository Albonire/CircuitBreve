// ============================================================
// LogicSVG Pro — SVG Gate Path Definitions
// ============================================================

// Each gate path is defined relative to a bounding box.
// The paths are designed for a standard gate size and will be
// scaled/translated to fit the node dimensions.

export interface GatePathDef {
  path: string;
  hasNegation: boolean; // Draw bubble at output
  viewBox: { x: number; y: number; w: number; h: number };
}

// Standard gate width/height for path definitions
const W = 60;
const H = 40;
const BUBBLE = 8;
const R = H / 2;

export const GATE_PATHS: Record<string, GatePathDef> = {
  AND: {
    path: `M 0 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W - R} ${H} L 0 ${H} Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  OR: {
    path: `M 0 0 Q ${W * 0.2} ${H / 2} 0 ${H} Q ${W * 0.62} ${H} ${W} ${H / 2} Q ${W * 0.62} 0 0 0 Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  NOT: {
    path: `M 0 0 L ${W - BUBBLE} ${H / 2} L 0 ${H} Z`,
    hasNegation: true,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  BUF: {
    path: `M 0 0 L ${W} ${H / 2} L 0 ${H} Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  NAND: {
    path: `M 0 0 L ${W - BUBBLE - R} 0 A ${R} ${R} 0 0 1 ${W - BUBBLE - R} ${H} L 0 ${H} Z`,
    hasNegation: true,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  NOR: {
    path: `M 0 0 Q ${W * 0.2} ${H / 2} 0 ${H} Q ${W * 0.58} ${H} ${W - BUBBLE} ${H / 2} Q ${W * 0.58} 0 0 0 Z`,
    hasNegation: true,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  XOR: {
    path: `M ${W * 0.08} 0 Q ${W * 0.28} ${H / 2} ${W * 0.08} ${H} Q ${W * 0.62} ${H} ${W} ${H / 2} Q ${W * 0.62} 0 ${W * 0.08} 0 Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  XNOR: {
    path: `M ${W * 0.08} 0 Q ${W * 0.28} ${H / 2} ${W * 0.08} ${H} Q ${W * 0.58} ${H} ${W - BUBBLE} ${H / 2} Q ${W * 0.58} 0 ${W * 0.08} 0 Z`,
    hasNegation: true,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  DFF: {
    path: `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  JKFF: {
    path: `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
  TFF: {
    path: `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`,
    hasNegation: false,
    viewBox: { x: 0, y: 0, w: W, h: H },
  },
};

// XOR has an extra arc line
export const XOR_EXTRA_ARC = `M 0 0 Q ${W * 0.2} ${H / 2} 0 ${H}`;
