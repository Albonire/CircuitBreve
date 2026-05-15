import { useTheme } from '@/context/ThemeContext';
import type { TruthTable } from '@/types';
import { Download } from 'lucide-react';
import { exportTruthTableCSV } from '@/simulator/simulator';

interface TruthTablePanelProps {
  truthTable: TruthTable | null;
}

export default function TruthTablePanel({ truthTable }: TruthTablePanelProps) {
  const { palette: p } = useTheme();

  if (!truthTable || truthTable.inputNames.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] italic p-4" style={{ color: p.textFaint }}>
        Define inputs and outputs to generate a truth table
      </div>
    );
  }

  const handleExportCSV = () => {
    const csv = exportTruthTableCSV(truthTable);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truth_table.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: p.bgPanel }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.textMuted }}>
          Truth Table · {truthTable.rows.length} rows
        </span>
        <button
          onClick={handleExportCSV}
          className="text-[10px] flex items-center gap-1 transition-colors"
          style={{ color: p.textMuted }}
          onMouseEnter={e => (e.currentTarget.style.color = p.textPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = p.textMuted)}
        >
          <Download size={11} /> CSV
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] font-mono border-collapse">
          <thead>
            <tr className="sticky top-0 z-10" style={{ background: p.bgSurface }}>
              {truthTable.inputNames.map(name => (
                <th key={`in-${name}`} className="px-3 py-1.5 font-semibold text-center" style={{ color: p.info, borderBottom: `1px solid ${p.border}` }}>
                  {name}
                </th>
              ))}
              <th style={{ borderLeft: `1px solid ${p.border}`, width: '1px' }} />
              {truthTable.outputNames.map(name => (
                <th key={`out-${name}`} className="px-3 py-1.5 font-semibold text-center" style={{ color: p.error, borderBottom: `1px solid ${p.border}` }}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {truthTable.rows.map((row, i) => (
              <tr key={i}>
                {truthTable.inputNames.map(name => (
                  <td
                    key={`in-${name}`}
                    className="px-3 py-0.5 text-center"
                    style={{
                      color: row.inputs.get(name) ? p.info : p.textFaint,
                      borderBottom: `1px solid ${p.borderSubtle}`,
                    }}
                  >
                    {row.inputs.get(name) ? '1' : '0'}
                  </td>
                ))}
                <td style={{ borderLeft: `1px solid ${p.border}`, borderBottom: `1px solid ${p.borderSubtle}`, width: '1px' }} />
                {truthTable.outputNames.map(name => (
                  <td
                    key={`out-${name}`}
                    className="px-3 py-0.5 text-center"
                    style={{
                      color: row.outputs.get(name) ? p.success : p.textFaint,
                      fontWeight: row.outputs.get(name) ? 700 : 400,
                      borderBottom: `1px solid ${p.borderSubtle}`,
                    }}
                  >
                    {row.outputs.get(name) ? '1' : '0'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
