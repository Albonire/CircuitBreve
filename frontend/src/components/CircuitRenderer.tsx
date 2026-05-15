import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTheme, type ThemePalette } from '@/context/ThemeContext';
import type { CircuitLayout, LayoutNode, Wire, SimulationState } from '@/types';
import { GATE_PATHS, XOR_EXTRA_ARC } from './gates/GatePaths';

interface CircuitRendererProps {
  layout: CircuitLayout;
  simulation: SimulationState | null;
  onToggleInput: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodeRename?: (nodeId: string, name: string) => void;
  onNodeResize?: (nodeId: string, w: number, h: number) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

interface ViewState { x: number; y: number; scale: number; }

interface CtxMenu {
  nodeId: string;
  screenX: number;
  screenY: number;
  node: LayoutNode;
}

// ── Shared sub-components ──

function InputNode({ node, on, p }: { node: LayoutNode; on: boolean; p: ThemePalette }) {
  const w = node.width, h = node.height;
  return (
    <g className="circuit-node">
      <rect x={0} y={0} width={w} height={h} rx={4} ry={4}
        fill={on ? p.nodeBodyOn : p.nodeBody}
        stroke={on ? p.inputAccent : p.nodeStroke} strokeWidth={1.3} />
      <text x={10} y={h / 2 + 3.5}
        fill={on ? p.inputAccent : p.textSecondary}
        fontSize={10} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
        {node.label}
      </text>
      <circle cx={w - 12} cy={h / 2} r={4.5}
        fill={on ? p.inputAccent : p.bgInset}
        stroke={on ? p.inputAccent : p.nodeStroke} strokeWidth={0.8} />
      <text x={w - 12} y={h / 2 + 3}
        fill={on ? '#fff' : p.textFaint}
        fontSize={6.5} fontFamily="'JetBrains Mono'" fontWeight={700} textAnchor="middle">
        {on ? '1' : '0'}
      </text>
      <circle cx={w} cy={h / 2} r={2} fill={on ? p.wireOn : p.nodeStroke} />
    </g>
  );
}

function OutputNode({ node, on, p }: { node: LayoutNode; on: boolean; p: ThemePalette }) {
  const w = node.width, h = node.height;
  return (
    <g className="circuit-node">
      <rect x={0} y={0} width={w} height={h} rx={4} ry={4}
        fill={on ? p.nodeBodyOn : p.nodeBody}
        stroke={on ? p.outputAccent : p.nodeStroke} strokeWidth={1.3} />
      <polygon
        points={`${w - 15},${h / 2 - 3.5} ${w - 9},${h / 2} ${w - 15},${h / 2 + 3.5}`}
        fill={on ? p.outputAccent : p.textFaint} />
      <text x={10} y={h / 2 + 3.5}
        fill={on ? p.outputAccent : p.textSecondary}
        fontSize={10} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
        {node.label}
      </text>
      {node.inputPins.map((pin, i) => (
        <circle key={i} cx={0} cy={pin.y - node.y} r={2}
          fill={on ? p.wireOn : p.nodeStroke} />
      ))}
    </g>
  );
}

function GateNodeSVG({ node, on, p }: { node: LayoutNode; on: boolean; p: ThemePalette }) {
  const gateDef = node.gateType ? GATE_PATHS[node.gateType] : null;
  const w = node.width, h = node.height;
  const fill = on ? p.nodeBodyOn : p.nodeBody;
  const stroke = on ? p.nodeStrokeOn : p.nodeStroke;
  const scaleX = w / 60, scaleY = h / 40;

  return (
    <g className="circuit-node">
      {gateDef ? (
        <g transform={`scale(${scaleX}, ${scaleY})`}>
          <path d={gateDef.path} fill={fill} stroke={stroke}
            strokeWidth={1.3 / Math.min(scaleX, scaleY)} strokeLinejoin="round" />
          {(node.gateType === 'XOR' || node.gateType === 'XNOR') && (
            <path d={XOR_EXTRA_ARC} fill="none" stroke={stroke}
              strokeWidth={1.3 / Math.min(scaleX, scaleY)} transform="translate(-4, 0)" />
          )}
          {gateDef.hasNegation && (
            <circle cx={56} cy={20} r={3.5}
              fill={fill} stroke={stroke} strokeWidth={1 / Math.min(scaleX, scaleY)} />
          )}
        </g>
      ) : (
        <rect x={0} y={0} width={w} height={h}
          rx={3} ry={3} fill={fill} stroke={stroke} strokeWidth={1.3} />
      )}
      <text x={w / 2} y={h / 2 + 3}
        fill={on ? p.nodeStrokeOn : p.textMuted} fontSize={8.5}
        fontFamily="'JetBrains Mono', monospace" fontWeight={700} textAnchor="middle">
        {node.label}
      </text>
      {node.inputPins.map((pin, i) => (
        <circle key={`i${i}`} cx={pin.x - node.x} cy={pin.y - node.y} r={2}
          fill={on ? p.wireOn : p.nodeStroke} />
      ))}
      {node.outputPins.map((pin, i) => (
        <circle key={`o${i}`} cx={pin.x - node.x} cy={pin.y - node.y} r={2}
          fill={on ? p.wireOn : p.nodeStroke} />
      ))}
    </g>
  );
}

function WireComp({ wire, simulation, p }: { wire: Wire; simulation: SimulationState | null; p: ThemePalette }) {
  const on = simulation?.values.get(wire.fromNodeId) ?? false;
  const color = on ? p.wireOn : p.wireOff;
  const pathStr = wire.segments.map((s, i) =>
    i === 0 ? `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}` : `L ${s.x2} ${s.y2}`
  ).join(' ');

  return (
    <g>
      {on && wire.segments.map((s, i) => (
        <line key={`g${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={p.wireGlow} strokeWidth={5} strokeLinecap="round" />
      ))}
      {wire.segments.map((s, i) => (
        <line key={`w${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={color} strokeWidth={on ? 1.4 : 0.9} strokeLinecap="round" />
      ))}
      {on && pathStr && (
        <circle r={1.8} fill={p.wireOn} opacity={0.85}>
          <animateMotion dur="1s" repeatCount="indefinite" path={pathStr} />
        </circle>
      )}
      {wire.segments.length > 1 && wire.segments.slice(0, -1).map((s, i) => (
        <circle key={`j${i}`} cx={s.x2} cy={s.y2} r={1} fill={color} />
      ))}
    </g>
  );
}

function Grid({ w, h, p }: { w: number; h: number; p: ThemePalette }) {
  return (
    <g opacity={0.1}>
      <defs>
        <pattern id="gd" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.35" fill={p.textFaint} />
        </pattern>
      </defs>
      <rect x={-400} y={-400} width={w + 800} height={h + 800} fill="url(#gd)" />
    </g>
  );
}

// ── Main Renderer ──
export default function CircuitRenderer({
  layout, simulation, onToggleInput, onNodeMove, onNodeRename, onNodeResize, svgRef: externalRef,
}: CircuitRendererProps) {
  const { palette: p } = useTheme();
  const internalRef = useRef<SVGSVGElement>(null);
  const svgRef = externalRef ?? internalRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffsets, setDragOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const dragStartRef = useRef({ x: 0, y: 0, nx: 0, ny: 0 });

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPos, setEditPos] = useState({ x: 0, y: 0 });
  const editRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeW, setResizeW] = useState(80);
  const [resizeH, setResizeH] = useState(44);

  useEffect(() => {
    if (containerRef.current && layout.nodes.length > 0) {
      const c = containerRef.current;
      const cw = c.clientWidth, ch = c.clientHeight;
      const lw = layout.width || 400, lh = layout.height || 300;
      const scale = Math.min((cw - 60) / lw, (ch - 60) / lh, 1.6);
      setView({ x: (cw - lw * scale) / 2, y: (ch - lh * scale) / 2, scale });
      setDragOffsets(new Map());
    }
  }, [layout]);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  // Convert screen → SVG coords
  const screenToSvg = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (sx - rect.left - view.x) / view.scale,
      y: (sy - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const d = e.deltaY > 0 ? 0.93 : 1.07;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setView(prev => {
      const ns = Math.max(0.2, Math.min(4, prev.scale * d));
      const r = ns / prev.scale;
      return { scale: ns, x: mx - (mx - prev.x) * r, y: my - (my - prev.y) * r };
    });
  }, []);

  // Canvas pan
  const onCanvasDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.circuit-node')) {
      setIsPanning(true);
      panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    }
  }, [view]);

  const onCanvasMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setView(prev => ({
        ...prev,
        x: panRef.current.vx + e.clientX - panRef.current.x,
        y: panRef.current.vy + e.clientY - panRef.current.y,
      }));
    }
    if (dragId) {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const dx = svgPt.x - dragStartRef.current.x;
      const dy = svgPt.y - dragStartRef.current.y;
      setDragOffsets(prev => {
        const next = new Map(prev);
        next.set(dragId, { dx, dy });
        return next;
      });
    }
  }, [isPanning, dragId, screenToSvg]);

  const onCanvasUp = useCallback(() => {
    if (dragId) {
      const off = dragOffsets.get(dragId);
      if (off && onNodeMove) {
        const node = layout.nodes.find(n => n.id === dragId);
        if (node) onNodeMove(dragId, node.x + off.dx, node.y + off.dy);
      }
      setDragId(null);
    }
    setIsPanning(false);
  }, [dragId, dragOffsets, layout.nodes, onNodeMove]);

  // Node interactions
  const handleNodeDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragStartRef.current = { x: svgPt.x, y: svgPt.y, nx: node.x, ny: node.y };
    setDragId(nodeId);
  }, [screenToSvg, layout.nodes]);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.kind === 'input') {
      onToggleInput(nodeId);
    }
  }, [layout.nodes, onToggleInput]);

  const handleNodeDblClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Get absolute position relative to the container
    const off = dragOffsets.get(nodeId);
    const nx = node.x + (off?.dx ?? 0);
    const ny = node.y + (off?.dy ?? 0);
    
    setEditingId(nodeId);
    setEditText(node.label);
    setEditPos({
      x: view.x + nx * view.scale,
      y: view.y + ny * view.scale,
    });
  }, [layout.nodes, view, dragOffsets]);

  const handleNodeCtx = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setCtxMenu({ nodeId, screenX: e.clientX, screenY: e.clientY, node });
    setResizeW(node.width);
    setResizeH(node.height);
  }, [layout.nodes]);

  const commitRename = useCallback(() => {
    if (editingId && onNodeRename) {
      onNodeRename(editingId, editText.trim() || "unnamed");
    }
    setEditingId(null);
  }, [editingId, editText, onNodeRename]);

  const getNodePos = (node: LayoutNode) => {
    const off = dragOffsets.get(node.id);
    return { x: node.x + (off?.dx ?? 0), y: node.y + (off?.dy ?? 0) };
  };

  // Recalculate wire endpoints with drag offsets
  const adjustedWire = (wire: Wire): Wire => {
    const fromOff = dragOffsets.get(wire.fromNodeId);
    const toOff = dragOffsets.get(wire.toNodeId);
    if (!fromOff && !toOff) return wire;
    const fdx = fromOff?.dx ?? 0, fdy = fromOff?.dy ?? 0;
    const tdx = toOff?.dx ?? 0, tdy = toOff?.dy ?? 0;
    const fp = { ...wire.fromPin, x: wire.fromPin.x + fdx, y: wire.fromPin.y + fdy };
    const tp = { ...wire.toPin, x: wire.toPin.x + tdx, y: wire.toPin.y + tdy };
    const midX = (fp.x + tp.x) / 2;
    const segments = Math.abs(fp.y - tp.y) < 1.5
      ? [{ x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y }]
      : [
          { x1: fp.x, y1: fp.y, x2: midX, y2: fp.y },
          { x1: midX, y1: fp.y, x2: midX, y2: tp.y },
          { x1: midX, y1: tp.y, x2: tp.x, y2: tp.y },
        ];
    return { ...wire, fromPin: fp, toPin: tp, segments };
  };

  const cursorStyle = dragId ? 'grabbing' : isPanning ? 'grabbing' : 'grab';

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative"
      style={{ background: p.bgCanvas }} onWheel={handleWheel}
      onClick={() => { setCtxMenu(null); }}>

      <svg ref={svgRef} className="w-full h-full"
        onMouseDown={onCanvasDown} onMouseMove={onCanvasMove}
        onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp}
        style={{ cursor: cursorStyle }}>
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          <Grid w={layout.width} h={layout.height} p={p} />

          {layout.wires.map(w => (
            <WireComp key={w.id} wire={adjustedWire(w)} simulation={simulation} p={p} />
          ))}

          {layout.nodes.map(n => {
            const val = simulation?.values.get(n.id) ?? false;
            const pos = getNodePos(n);
            const isDragging = dragId === n.id;
            return (
              <g key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={e => handleNodeDown(e, n.id)}
                onClick={e => handleNodeClick(e, n.id)}
                onDoubleClick={e => handleNodeDblClick(e, n.id)}
                onContextMenu={e => handleNodeCtx(e, n.id)}
                style={{ cursor: isDragging ? 'grabbing' : 'pointer', opacity: isDragging ? 0.8 : 1 }}
              >
                {n.kind === 'input' && <InputNode node={n} on={val} p={p} />}
                {n.kind === 'output' && <OutputNode node={n} on={val} p={p} />}
                {n.kind === 'gate' && <GateNodeSVG node={n} on={val} p={p} />}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Rename input overlay */}
      {editingId && (
        <input ref={editRef} value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
          className="absolute z-50 text-[11px] font-mono px-1.5 py-0.5 rounded outline-none"
          style={{
            left: editPos.x, top: editPos.y,
            background: p.bgElevated, color: p.textPrimary,
            border: `1.5px solid ${p.accent}`, minWidth: 60,
          }}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div className="absolute z-50 py-1 rounded-md shadow-xl min-w-[180px]"
          style={{
            left: ctxMenu.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: ctxMenu.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0),
            background: p.bgElevated, border: `1px solid ${p.border}`,
          }}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: p.textFaint, borderBottom: `1px solid ${p.borderSubtle}` }}>
            {ctxMenu.node.label} <span className="font-normal">({ctxMenu.node.kind})</span>
          </div>

          {/* Rename */}
          <button className="w-full text-left px-3 py-1.5 text-[11px] transition-colors"
            style={{ color: p.textSecondary }}
            onMouseEnter={e => { e.currentTarget.style.background = p.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => {
              setCtxMenu(null);
              // trigger rename
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const off = dragOffsets.get(ctxMenu.nodeId);
              setEditingId(ctxMenu.nodeId);
              setEditText(ctxMenu.node.label);
              setEditPos({
                x: rect.left + view.x + (ctxMenu.node.x + (off?.dx ?? 0)) * view.scale,
                y: rect.top + view.y + (ctxMenu.node.y + (off?.dy ?? 0)) * view.scale - 2,
              });
            }}>
            ✏️ Rename
          </button>

          {/* Toggle (only inputs) */}
          {ctxMenu.node.kind === 'input' && (
            <button className="w-full text-left px-3 py-1.5 text-[11px] transition-colors"
              style={{ color: p.textSecondary }}
              onMouseEnter={e => { e.currentTarget.style.background = p.bgHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onToggleInput(ctxMenu.nodeId); setCtxMenu(null); }}>
              ⚡ Toggle value
            </button>
          )}

          {/* Resize */}
          <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${p.borderSubtle}` }}>
            <p className="text-[9px] font-bold uppercase mb-1" style={{ color: p.textFaint }}>Resize</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span style={{ color: p.textMuted }}>W</span>
              <input type="range" min={50} max={180} step={2} value={resizeW}
                onChange={e => { setResizeW(Number(e.target.value)); setResizingId(ctxMenu.nodeId); }}
                className="flex-1 h-1" style={{ accentColor: p.accent }} />
              <span className="font-mono w-8 text-right" style={{ color: p.textPrimary }}>{resizeW}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] mt-0.5">
              <span style={{ color: p.textMuted }}>H</span>
              <input type="range" min={24} max={90} step={2} value={resizeH}
                onChange={e => { setResizeH(Number(e.target.value)); setResizingId(ctxMenu.nodeId); }}
                className="flex-1 h-1" style={{ accentColor: p.accent }} />
              <span className="font-mono w-8 text-right" style={{ color: p.textPrimary }}>{resizeH}</span>
            </div>
            <button className="mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ background: p.accent, color: '#fff' }}
              onClick={() => {
                if (resizingId && onNodeResize) onNodeResize(resizingId, resizeW, resizeH);
                setCtxMenu(null);
              }}>
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Zoom */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <button onClick={() => setView(v => ({ ...v, scale: Math.min(4, v.scale * 1.2) }))}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px]"
          style={{ background: p.bgElevated, color: p.textSecondary, border: `1px solid ${p.border}` }}>+</button>
        <span className="text-[8px] font-mono px-1 py-0.5 rounded min-w-[30px] text-center"
          style={{ background: p.bgElevated, color: p.textFaint, border: `1px solid ${p.border}` }}>
          {Math.round(view.scale * 100)}%
        </span>
        <button onClick={() => setView(v => ({ ...v, scale: Math.max(0.2, v.scale * 0.8) }))}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px]"
          style={{ background: p.bgElevated, color: p.textSecondary, border: `1px solid ${p.border}` }}>−</button>
      </div>

      {layout.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ color: p.textFaint }}>
            <p className="text-[11px]">Write HDL to see the circuit</p>
          </div>
        </div>
      )}
    </div>
  );
}
