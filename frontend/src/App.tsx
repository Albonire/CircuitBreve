import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play, Download, Terminal, ChevronDown,
  ToggleLeft, BookOpen, Camera, Table,
  Ruler, Sun, Moon, X, Wand2, Zap
} from 'lucide-react';
import CodeEditor from '@/components/CodeEditor';
import CircuitRenderer from '@/components/CircuitRenderer';
import DiagnosticsPanel from '@/components/DiagnosticsPanel';
import TruthTablePanel from '@/components/TruthTablePanel';
import DocsPanel from '@/components/DocsPanel';
import DimensionsPanel, { DEFAULT_DIMENSIONS, type DimensionConfig } from '@/components/DimensionsPanel';
import VisionPanel from '@/components/VisionPanel';
import BoolExprConverter from '@/components/BoolExprConverter';
import ResizeHandle from '@/components/ResizeHandle';
import { useCircuit } from '@/hooks/useCircuit';
import { useResizable, useResizableInverted } from '@/hooks/useResizable';
import { useTheme } from '@/context/ThemeContext';
import { exportSVG, exportPNG, exportPDF } from '@/utils/exportUtils';

const EXAMPLES: Record<string, string> = {
  'Full Adder': `# Full Adder Module
MODULE HalfAdder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}

INPUT A, B, Cin

S1, C1 = HalfAdder(A, B)
Sum, C2 = HalfAdder(S1, Cin)
Cout = OR(C1, C2)

OUTPUT Sum
OUTPUT Cout`,

  '2-to-1 MUX': `INPUT A, B, Sel

NotSel = NOT(Sel)
TermA = AND(A, NotSel)
TermB = AND(B, Sel)
Out = OR(TermA, TermB)

OUTPUT Out`,

  'SR Latch': `INPUT S, R
Q = NOR(R, Qn)
Qn = NOR(S, Q)
OUTPUT Q
OUTPUT Qn`,

  'Parity': `INPUT D0, D1, D2, D3
X1 = XOR(D0, D1)
X2 = XOR(D2, D3)
P = XOR(X1, X2)
OUTPUT P`,
};

const DEFAULT_CODE = EXAMPLES['Full Adder'];

type BottomPanel = 'diagnostics' | 'truthtable' | null;
type RightPanel = 'docs' | 'dimensions' | 'converter' | 'vision' | null;

export default function App() {
  const { mode, palette: p, toggleTheme } = useTheme();
  const isDark = mode === 'dark';

  const [code, setCode] = useState(DEFAULT_CODE);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('diagnostics');
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [autoCompile, setAutoCompile] = useState(true);
  const [dimConfig, setDimConfig] = useState<DimensionConfig>(DEFAULT_DIMENSIONS);
  const dimConfigRef = useRef(dimConfig);
  const svgRef = useRef<SVGSVGElement>(null);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { dimConfigRef.current = dimConfig; }, [dimConfig]);

  // Resizable panels
  const leftPanel = useResizable({
    direction: 'horizontal',
    initialSize: 340,
    minSize: 220,
    maxSize: 580,
  });

  const rightPanelResize = useResizableInverted({
    direction: 'horizontal',
    initialSize: 300,
    minSize: 220,
    maxSize: 500,
  });

  const bottomPanelResize = useResizableInverted({
    direction: 'vertical',
    initialSize: 180,
    minSize: 100,
    maxSize: 450,
  });

  const {
    graph, layout, simulation, diagnostics, truthTable,
    compile, reLayout, toggleInput,
  } = useCircuit();

  useEffect(() => {
    if (!autoCompile) return;
    if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
    compileTimerRef.current = setTimeout(() => compile(code, dimConfigRef.current), 400);
    return () => { if (compileTimerRef.current) clearTimeout(compileTimerRef.current); };
  }, [code, autoCompile, compile]);

  useEffect(() => { compile(code, dimConfig); }, []); // eslint-disable-line

  const handleCompile = useCallback(() => compile(code, dimConfig), [code, compile, dimConfig]);

  const handleExport = useCallback((format: 'svg' | 'png' | 'pdf') => {
    if (!svgRef.current) return;
    if (format === 'svg') exportSVG(svgRef.current);
    else if (format === 'png') exportPNG(svgRef.current);
    else exportPDF(svgRef.current);
    setShowExportMenu(false);
  }, []);

  const toggleBottomPanel = useCallback((panel: BottomPanel) =>
    setBottomPanel(prev => prev === panel ? null : panel), []);
  const toggleRightPanel = useCallback((panel: RightPanel) =>
    setRightPanel(prev => prev === panel ? null : panel), []);

  const handleDimChange = useCallback((config: DimensionConfig) => setDimConfig(config), []);
  const handleDimApply = useCallback(() => reLayout(dimConfig), [reLayout, dimConfig]);

  const handleNodeResize = useCallback((nodeId: string, w: number, h: number) => {
    setDimConfig(prev => {
      const overrides = new Map(prev.nodeOverrides);
      overrides.set(nodeId, { width: w, height: h });
      return { ...prev, nodeOverrides: overrides };
    });
    setTimeout(() => { setDimConfig(current => { reLayout(current); return current; }); }, 0);
  }, [reLayout]);

  const handleNodeRename = useCallback((nodeId: string, newName: string) => {
    if (!graph) return;
    const node = graph.nodes.get(nodeId);
    if (!node) return;
    const oldName = node.label;
    if (oldName === newName) return;
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    setCode(code.replace(regex, newName));
  }, [graph, code]);

  const handleInsertCode = useCallback((newCode: string) => {
    setCode(newCode);
    setRightPanel(null);
  }, []);

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;

  // iOS-style panel styling: border glow + inset shadow
  const panelStyle = {
    background: p.bgSurface,
    border: `1px solid ${p.border}`,
    boxShadow: isDark
      ? `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 0 0 0.5px rgba(255,255,255,0.03), 0 2px 8px rgba(0,0,0,0.3)`
      : `inset 0 1px 0 0 rgba(255,255,255,0.7), 0 0 0 0.5px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)`,
  };

  const canvasPanelStyle = {
    background: p.bgCanvas,
    border: `1px solid ${p.border}`,
    boxShadow: isDark
      ? `inset 0 1px 0 0 rgba(255,255,255,0.03), 0 0 0 0.5px rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.3)`
      : `inset 0 1px 0 0 rgba(255,255,255,0.6), 0 0 0 0.5px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)`,
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden p-1 gap-1" style={{ background: p.bgApp }}>
      
      {/* ─── Top Bar ─── */}
      <header
        className="flex-shrink-0 h-11 rounded-2xl flex items-center justify-between px-4"
        style={panelStyle}
      >
        {/* Left: Branding & Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[13px] font-bold tracking-tight" style={{ color: p.textPrimary }}>
              CircuitBreve
            </h1>
          </div>
          <div className="w-px h-4" style={{ background: p.border }} />
          <select
            value={Object.keys(EXAMPLES).find(k => EXAMPLES[k] === code) ?? ''}
            onChange={e => { if (e.target.value && EXAMPLES[e.target.value]) setCode(EXAMPLES[e.target.value]); }}
            className="text-[11px] px-2.5 py-1 rounded-lg outline-none cursor-pointer font-medium"
            style={{ background: p.bgElevated, color: p.textSecondary, border: `1px solid ${p.borderSubtle}` }}
          >
            <option value="">Custom...</option>
            {Object.keys(EXAMPLES).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Right: Main Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoCompile(!autoCompile)}
            className="flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-medium rounded-lg transition-all"
            style={{
              background: autoCompile ? p.successSoft : p.bgElevated,
              color: autoCompile ? p.success : p.textMuted,
              border: `1px solid ${autoCompile ? p.success + '40' : p.borderSubtle}`,
            }}
          >
            <ToggleLeft size={13} /> Auto
          </button>

          <button
            onClick={handleCompile}
            className="flex items-center gap-1.5 px-3.5 h-7 text-[11px] font-semibold rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: p.accent }}
          >
            <Play size={11} fill="currentColor" /> Compile
          </button>

          <div className="w-px h-4 mx-1" style={{ background: p.borderSubtle }} />

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-lg transition-colors"
              style={{ background: p.bgElevated, color: p.textSecondary, border: `1px solid ${p.borderSubtle}` }}
            >
              <Download size={13} /> Export <ChevronDown size={10} />
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 w-32 py-1 rounded-2xl shadow-2xl z-50"
                style={{ background: p.bgElevated, border: `1px solid ${p.border}`, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)' }}
              >
                {([['svg', 'SVG'], ['png', 'PNG'], ['pdf', 'PDF']] as const).map(([fmt, label]) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt as 'svg' | 'png' | 'pdf')}
                    className="w-full text-left px-3 py-1.5 text-[11px] transition-colors"
                    style={{ color: p.textPrimary }}
                    onMouseEnter={e => (e.currentTarget.style.background = p.bgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors ml-1"
            style={{ color: p.textSecondary, background: p.bgElevated, border: `1px solid ${p.borderSubtle}` }}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </header>

      {/* ─── Main Content (Bento Grid) ─── */}
      <div className="flex-1 flex min-h-0 gap-1">
        
        {/* Left Panel: Editor */}
        <div
          className="flex-shrink-0 flex flex-col min-h-0 rounded-2xl overflow-hidden"
          style={{ width: leftPanel.size, ...panelStyle }}
        >
          {/* Editor Tab Bar */}
          <div
            className="h-8 flex items-center justify-between px-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${p.borderSubtle}` }}
          >
            <span className="text-[11px] font-medium" style={{ color: p.textSecondary }}>
              circuit.hdl
            </span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: p.textFaint }}>
              {code.split('\n').length} ln
            </span>
          </div>
          {/* Editor Content */}
          <div className="flex-1 min-h-0" style={{ background: p.bgEditor }}>
            <CodeEditor code={code} onChange={setCode} diagnostics={diagnostics} />
          </div>
        </div>

        {/* Resize Handle: Left ↔ Center */}
        <ResizeHandle direction="horizontal" onMouseDown={leftPanel.handleMouseDown} />

        {/* Center + Right Column */}
        <div className="flex-1 flex min-h-0 min-w-0 gap-1">
          
          {/* Center: Canvas + Bottom Panel */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-1">
            
            {/* Canvas Area */}
            <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden" style={canvasPanelStyle}>
              {/* Floating Toggle: Output / Table */}
              <div
                className="absolute top-3 left-3 flex items-center z-10 p-[3px] rounded-full"
                style={{
                  background: isDark ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${p.border}`,
                  boxShadow: isDark
                    ? 'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.4)'
                    : 'inset 0 1px 0 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {([
                  { id: 'diagnostics' as BottomPanel, icon: <Terminal size={12} />, label: 'Output', badge: errorCount > 0 },
                  { id: 'truthtable' as BottomPanel, icon: <Table size={12} />, label: 'Table', badge: false },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => toggleBottomPanel(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-full transition-all"
                    style={{
                      color: bottomPanel === tab.id ? (isDark ? '#fff' : '#000') : p.textMuted,
                      background: bottomPanel === tab.id
                        ? (isDark ? 'rgba(88,166,255,0.15)' : 'rgba(37,99,235,0.1)')
                        : 'transparent',
                      boxShadow: bottomPanel === tab.id
                        ? (isDark ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.5)')
                        : 'none',
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && <div className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: p.error }} />}
                  </button>
                ))}
              </div>

              {/* Floating Toggle: Right panel tools */}
              <div
                className="absolute top-3 right-3 flex items-center z-10 p-[3px] rounded-full"
                style={{
                  background: isDark ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${p.border}`,
                  boxShadow: isDark
                    ? 'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.4)'
                    : 'inset 0 1px 0 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {([
                  { id: 'dimensions' as RightPanel, icon: <Ruler size={12} /> },
                  { id: 'vision' as RightPanel, icon: <Camera size={12} /> },
                  { id: 'converter' as RightPanel, icon: <Wand2 size={12} /> },
                  { id: 'docs' as RightPanel, icon: <BookOpen size={12} /> },
                ]).map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => toggleRightPanel(btn.id)}
                    className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
                    style={{
                      color: rightPanel === btn.id ? (isDark ? '#fff' : '#000') : p.textMuted,
                      background: rightPanel === btn.id
                        ? (isDark ? 'rgba(88,166,255,0.15)' : 'rgba(37,99,235,0.1)')
                        : 'transparent',
                      boxShadow: rightPanel === btn.id
                        ? (isDark ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.5)')
                        : 'none',
                    }}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>

              <CircuitRenderer
                layout={layout ?? { nodes: [], wires: [], width: 400, height: 300 }}
                simulation={simulation}
                onToggleInput={toggleInput}
                onNodeResize={handleNodeResize}
                onNodeRename={handleNodeRename}
                svgRef={svgRef}
              />
            </div>

            {/* Bottom Panel */}
            {bottomPanel && (
              <>
                <ResizeHandle direction="vertical" onMouseDown={bottomPanelResize.handleMouseDown} />
                <div
                  className="flex-shrink-0 min-h-0 rounded-2xl overflow-hidden"
                  style={{ height: bottomPanelResize.size, ...panelStyle }}
                >
                  {bottomPanel === 'diagnostics' && <DiagnosticsPanel diagnostics={diagnostics} />}
                  {bottomPanel === 'truthtable' && <TruthTablePanel truthTable={truthTable} />}
                </div>
              </>
            )}
          </div>

          {/* Right Panel: Tools */}
          {rightPanel && (
            <>
              <ResizeHandle direction="horizontal" onMouseDown={rightPanelResize.handleMouseDown} />
              <div
                className="flex-shrink-0 flex flex-col min-h-0 rounded-2xl overflow-hidden"
                style={{ width: rightPanelResize.size, ...panelStyle }}
              >
                {/* Right Panel Header */}
                <div
                  className="flex items-center justify-between px-3 h-8 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${p.borderSubtle}` }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: p.textSecondary }}>
                    {rightPanel === 'docs' && 'Documentation'}
                    {rightPanel === 'dimensions' && 'Layout Settings'}
                    {rightPanel === 'vision' && 'Image → HDL'}
                    {rightPanel === 'converter' && 'Math → HDL'}
                  </span>
                  <button
                    onClick={() => setRightPanel(null)}
                    className="w-5 h-5 flex items-center justify-center rounded-full transition-colors"
                    style={{ color: p.textMuted }}
                    onMouseEnter={e => (e.currentTarget.style.color = p.textPrimary)}
                    onMouseLeave={e => (e.currentTarget.style.color = p.textMuted)}
                  >
                    <X size={11} />
                  </button>
                </div>
                {/* Right Panel Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {rightPanel === 'docs' && <DocsPanel />}
                  {rightPanel === 'dimensions' && (
                    <DimensionsPanel layout={layout} config={dimConfig} onChange={handleDimChange} onApply={handleDimApply} />
                  )}
                  {rightPanel === 'vision' && (
                    <VisionPanel onInsertCode={handleInsertCode} />
                  )}
                  {rightPanel === 'converter' && (
                    <BoolExprConverter onInsertCode={handleInsertCode} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Click-away for export menu */}
      {showExportMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
      )}
    </div>
  );
}
