import { useTheme } from '@/context/ThemeContext';
import type { Diagnostic } from '@/types';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
}

function DiagIcon({ severity, size = 13 }: { severity: Diagnostic['severity']; size?: number }) {
  const { palette: p } = useTheme();
  const colors = { error: p.error, warning: p.warning, info: p.info };
  const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };
  const Icon = icons[severity];
  return <Icon size={size} style={{ color: colors[severity], flexShrink: 0 }} />;
}

export default function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  const { palette: p } = useTheme();
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;

  return (
    <div className="h-full flex flex-col" style={{ background: p.bgPanel }}>
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.textMuted }}>
          Output
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          {errors > 0 && (
            <span className="flex items-center gap-1 font-medium" style={{ color: p.error }}>
              <AlertCircle size={11} /> {errors} error{errors > 1 ? 's' : ''}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 font-medium" style={{ color: p.warning }}>
              <AlertTriangle size={11} /> {warnings}
            </span>
          )}
          {diagnostics.length === 0 && (
            <span className="flex items-center gap-1 font-medium" style={{ color: p.success }}>
              <CheckCircle size={11} /> No issues
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 py-1.5">
        {diagnostics.length === 0 ? (
          <div className="text-[11px] px-2 py-4 text-center" style={{ color: p.textFaint }}>
            Circuit compiled successfully — no diagnostics
          </div>
        ) : (
          <div className="space-y-0.5">
            {diagnostics.map((diag, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2.5 py-2 rounded-md text-[11px] font-mono"
                style={{
                  background: diag.severity === 'error' ? p.errorSoft : (diag.severity === 'warning' ? p.warningSoft : 'transparent'),
                }}
              >
                <DiagIcon severity={diag.severity} />
                <span style={{ color: p.textSecondary, lineHeight: '1.5' }}>
                  {diag.line > 0 && (
                    <span className="font-semibold" style={{ color: p.textMuted }}>[{diag.line}:{diag.col}] </span>
                  )}
                  {diag.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
