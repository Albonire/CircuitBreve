import { useTheme } from '@/context/ThemeContext';
import { useState, useCallback, useEffect } from 'react';
import { Ruler, Settings2, Maximize2, Minimize2, RotateCcw, ChevronDown, Type, BoxSelect } from 'lucide-react';
import type { CircuitLayout } from '@/types';

export interface DimensionConfig {
  layerGap: number;
  nodeGap: number;
  padding: number;
  gateWidth: number;
  gateHeight: number;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  nodeOverrides: Map<string, { width: number; height: number }>;
}

export const DEFAULT_DIMENSIONS: DimensionConfig = {
  layerGap: 140, nodeGap: 60, padding: 50,
  gateWidth: 72, gateHeight: 44,
  inputWidth: 68, inputHeight: 36,
  outputWidth: 68, outputHeight: 36,
  nodeOverrides: new Map(),
};

interface DimensionsPanelProps {
  layout: CircuitLayout | null;
  config: DimensionConfig;
  onChange: (config: DimensionConfig) => void;
  onApply: () => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  const { palette: p } = useTheme();
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-[11px] w-20 flex-shrink-0" style={{ color: p.textSecondary }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded-full cursor-pointer"
        style={{ background: p.bgInset, accentColor: p.accent }} />
      <span className="text-[10px] font-mono w-12 text-right" style={{ color: p.textPrimary }}>
        {value}{unit}
      </span>
    </div>
  );
}

export default function DimensionsPanel({ layout, config, onChange, onApply }: DimensionsPanelProps) {
  const { palette: p } = useTheme();
  const [activeTab, setActiveTab] = useState<'global' | 'types' | 'nodes'>('global');
  const [localConfig, setLocalConfig] = useState<DimensionConfig>(config);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => { setLocalConfig(config); }, [config]);

  const update = useCallback((partial: Partial<DimensionConfig>) => {
    setLocalConfig(prev => {
      const next = { ...prev, ...partial };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const updateNode = useCallback((nodeId: string, width: number, height: number) => {
    setLocalConfig(prev => {
      const overrides = new Map(prev.nodeOverrides);
      overrides.set(nodeId, { width, height });
      const next = { ...prev, nodeOverrides: overrides };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const reset = useCallback(() => {
    setLocalConfig(DEFAULT_DIMENSIONS);
    onChange(DEFAULT_DIMENSIONS);
  }, [onChange]);

  const tabs = [
    { id: 'global' as const, label: 'Spacing', icon: <BoxSelect size={10} /> },
    { id: 'types' as const, label: 'By Type', icon: <Type size={10} /> },
    { id: 'nodes' as const, label: 'Per Node', icon: <Settings2 size={10} /> },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-[12px] font-bold" style={{ color: p.textPrimary }}>Dimensions</h2>
            <p className="text-[10px]" style={{ color: p.textFaint }}>Component sizes & spacing</p>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors"
          style={{ color: p.textMuted }} onMouseEnter={e => (e.currentTarget.style.color = p.textPrimary)} onMouseLeave={e => (e.currentTarget.style.color = p.textMuted)}>
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="flex-shrink-0 flex" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? p.accent : p.textMuted,
              borderBottom: activeTab === tab.id ? `2px solid ${p.accent}` : '2px solid transparent',
              background: activeTab === tab.id ? p.accentSoft : 'transparent',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">
        {activeTab === 'global' && (
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: p.textFaint }}>Layout Spacing</p>
            <Slider label="Layer Gap" value={localConfig.layerGap} min={80} max={300} step={10} unit="px" onChange={v => update({ layerGap: v })} />
            <Slider label="Node Gap" value={localConfig.nodeGap} min={30} max={150} step={5} unit="px" onChange={v => update({ nodeGap: v })} />
            <Slider label="Padding" value={localConfig.padding} min={20} max={120} step={5} unit="px" onChange={v => update({ padding: v })} />
            <div className="mt-3 p-2.5 rounded-md text-[10px] leading-relaxed" style={{ background: p.bgInset, color: p.textMuted }}>
              <p><strong>Layer Gap:</strong> Horizontal distance between columns.</p>
              <p><strong>Node Gap:</strong> Vertical space between nodes in a column.</p>
              <p><strong>Padding:</strong> Margin around the circuit.</p>
            </div>
          </div>
        )}

        {activeTab === 'types' && (
          <div className="space-y-4">
            {[
              { label: 'Gate Nodes', icon: <Maximize2 size={10} />, wKey: 'gateWidth' as const, hKey: 'gateHeight' as const },
              { label: 'Input Nodes', icon: <Minimize2 size={10} />, wKey: 'inputWidth' as const, hKey: 'inputHeight' as const },
              { label: 'Output Nodes', icon: <Minimize2 size={10} />, wKey: 'outputWidth' as const, hKey: 'outputHeight' as const },
            ].map(cat => (
              <div key={cat.label}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: p.textFaint }}>
                  {cat.icon} {cat.label}
                </p>
                <Slider label="Width" value={localConfig[cat.wKey]} min={50} max={180} step={5} unit="px" onChange={v => update({ [cat.wKey]: v })} />
                <Slider label="Height" value={localConfig[cat.hKey]} min={24} max={90} step={4} unit="px" onChange={v => update({ [cat.hKey]: v })} />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nodes' && (
          <div>
            {!layout || layout.nodes.length === 0 ? (
              <div className="text-center py-8 text-[11px]" style={{ color: p.textFaint }}>
                <BoxSelect size={20} className="mx-auto mb-2 opacity-30" />
                <p>Compile a circuit first</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: p.textFaint }}>
                  {layout.nodes.length} nodes
                </p>
                <div className="relative">
                  <select value={selectedNodeId ?? ''} onChange={(e) => setSelectedNodeId(e.target.value || null)}
                    className="w-full px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer outline-none"
                    style={{ background: p.bgElevated, color: p.textPrimary, border: `1px solid ${p.border}` }}>
                    <option value="">Select node…</option>
                    {layout.nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.kind})</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.textFaint }} />
                </div>

                {selectedNodeId && (() => {
                  const node = layout.nodes.find(n => n.id === selectedNodeId);
                  if (!node) return null;
                  const ov = localConfig.nodeOverrides.get(node.id);
                  const w = ov?.width ?? node.width;
                  const h = ov?.height ?? node.height;
                  return (
                    <div className="mt-2 p-2.5 rounded-md" style={{ background: p.bgInset, border: `1px solid ${p.borderSubtle}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold" style={{ color: p.textPrimary }}>{node.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: p.bgElevated, color: p.textFaint }}>{node.kind}</span>
                      </div>
                      <Slider label="Width" value={w} min={40} max={200} step={5} unit="px" onChange={v => updateNode(node.id, v, h)} />
                      <Slider label="Height" value={h} min={20} max={100} step={4} unit="px" onChange={v => updateNode(node.id, w, v)} />
                      {ov && (
                        <button onClick={() => {
                          setLocalConfig(prev => {
                            const overrides = new Map(prev.nodeOverrides);
                            overrides.delete(node.id);
                            const next = { ...prev, nodeOverrides: overrides };
                            onChange(next);
                            return next;
                          });
                        }} className="mt-2 text-[10px] px-2 py-0.5 rounded" style={{ color: p.error }}>
                          Remove override
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-2.5" style={{ borderTop: `1px solid ${p.borderSubtle}` }}>
        <button onClick={onApply}
          className="w-full py-2 rounded-lg text-[11px] font-semibold text-white transition-all"
          style={{ background: p.accent, boxShadow: `0 2px 10px ${p.accent}30` }}>
          Apply & Re-layout
        </button>
      </div>
    </div>
  );
}
