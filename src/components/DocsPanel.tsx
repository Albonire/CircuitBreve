import { useTheme } from '@/context/ThemeContext';
import {
  BookOpen, ChevronRight, Terminal, Layers, ArrowRight,
  Cpu, Zap, Lightbulb, CheckCircle2, Copy, Check
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { palette: p } = useTheme();

  return (
    <div className="mb-1.5 rounded-lg overflow-hidden" style={{ border: `1px solid ${p.borderSubtle}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
        style={{ background: p.bgSurface }}
        onMouseEnter={e => (e.currentTarget.style.background = p.bgHover)}
        onMouseLeave={e => (e.currentTarget.style.background = p.bgSurface)}
      >
        <span style={{ color: p.accent }}>{icon}</span>
        <span className="text-[12px] font-semibold" style={{ color: p.textPrimary }}>{title}</span>
        <ChevronRight
          size={13}
          className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`}
          style={{ color: p.textFaint }}
        />
      </button>
      {open && (
        <div className="px-3.5 py-3 text-[12px] leading-relaxed" style={{ color: p.textSecondary }}>
          {children}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { palette: p } = useTheme();
  return (
    <div className="my-2.5 rounded-md overflow-hidden" style={{ border: `1px solid ${p.borderSubtle}` }}>
      {label && (
        <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ background: p.bgSurface, color: p.textFaint }}>
          {label}
        </div>
      )}
      <pre className="p-2.5 overflow-x-auto text-[10.5px] font-mono leading-relaxed" style={{ background: p.bgInset, color: p.success }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  const { palette: p } = useTheme();
  return (
    <code className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: p.bgElevated, color: p.warning }}>
      {children}
    </code>
  );
}

export default function DocsPanel() {
  const { palette: p } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(() => {
    if (!contentRef.current) return;
    const text = contentRef.current.innerText;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <div className="flex items-center gap-2.5">
          <div>
            <h2 className="text-[12px] font-bold" style={{ color: p.textPrimary }}>Documentation</h2>
            <p className="text-[10px]" style={{ color: p.textFaint }}>HDL syntax reference</p>
          </div>
        </div>
        <button onClick={handleCopyAll}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{ background: p.bgElevated, color: copied ? p.success : p.textMuted, border: `1px solid ${p.borderSubtle}` }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy all'}
        </button>
      </div>

      <div ref={contentRef} className="flex-1 overflow-auto px-3 py-3">
        <Section title="Quick Start" icon={<Zap size={13} />} defaultOpen={true}>
          <p className="mb-2">
            Write digital circuits using a simple HDL. The compiler parses your code, builds a graph, and renders a schematic instantly.
          </p>
          <CodeBlock label="Minimal example" code={`INPUT A, B
C = AND(A, B)
OUTPUT C`} />
          <div className="flex items-start gap-2 mt-2 p-2 rounded-md text-[11px]" style={{ background: p.infoSoft, color: p.info }}>
            <Lightbulb size={12} className="flex-shrink-0 mt-0.5" />
            <span>Click any <strong>INPUT</strong> node on the schematic to toggle its value and see the simulation update in real time.</span>
          </div>
        </Section>

        <Section title="Syntax Reference" icon={<Terminal size={13} />}>
          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1" style={{ color: p.textPrimary }}>1. Inputs</p>
              <CodeBlock code="INPUT A, B, Cin" />
              <p className="text-[11px]">Declares clickable input signals. Separate multiple names with commas.</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: p.textPrimary }}>2. Outputs</p>
              <CodeBlock code={`OUTPUT Sum\nOUTPUT Cout = OR(C1, C2)`} />
              <p className="text-[11px]">Declares output signals. Can optionally include an inline expression.</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: p.textPrimary }}>3. Gate Assignments</p>
              <CodeBlock code={`X = AND(A, B)\nY = OR(X, NOT(C))`} />
              <p className="text-[11px]">Assign the result of a gate (with optional nesting) to a wire name.</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: p.textPrimary }}>4. Modules</p>
              <CodeBlock label="Definition" code={`MODULE HalfAdder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}`} />
              <CodeBlock label="Instantiation" code="S1, C1 = HalfAdder(A, B)" />
              <p className="text-[11px]">Reusable subcircuits. Outputs on the left, module call on the right.</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: p.textPrimary }}>5. Comments</p>
              <CodeBlock code="# This is a comment" />
            </div>
          </div>
        </Section>

        <Section title="Supported Gates" icon={<Cpu size={13} />}>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { name: 'AND', desc: 'Logical AND', n: '2+' },
              { name: 'OR', desc: 'Logical OR', n: '2+' },
              { name: 'NOT', desc: 'Inverter', n: '1' },
              { name: 'NAND', desc: 'NOT-AND', n: '2+' },
              { name: 'NOR', desc: 'NOT-OR', n: '2+' },
              { name: 'XOR', desc: 'Exclusive OR', n: '2' },
              { name: 'XNOR', desc: 'Exclusive NOR', n: '2' },
              { name: 'BUF', desc: 'Buffer', n: '1' },
              { name: 'DFF', desc: 'D Flip-Flop', n: '1' },
              { name: 'TFF', desc: 'T Flip-Flop', n: '1' },
            ].map(g => (
              <div key={g.name} className="flex items-center gap-2 p-1.5 rounded" style={{ background: p.bgInset }}>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: p.bgElevated, color: p.success }}>
                  {g.name}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] truncate" style={{ color: p.textSecondary }}>{g.desc}</p>
                  <p className="text-[9px]" style={{ color: p.textFaint }}>{g.n} in</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Examples" icon={<Layers size={13} />}>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-[11px] mb-1" style={{ color: p.textPrimary }}>Full Adder</p>
              <CodeBlock code={`MODULE HalfAdder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}

INPUT A, B, Cin
S1, C1 = HalfAdder(A, B)
Sum, C2 = HalfAdder(S1, Cin)
Cout = OR(C1, C2)
OUTPUT Sum
OUTPUT Cout`} />
            </div>
            <div>
              <p className="font-semibold text-[11px] mb-1" style={{ color: p.textPrimary }}>2:1 Multiplexer</p>
              <CodeBlock code={`INPUT A, B, Sel
NotSel = NOT(Sel)
TermA = AND(A, NotSel)
TermB = AND(B, Sel)
Out = OR(TermA, TermB)
OUTPUT Out`} />
            </div>
          </div>
        </Section>

        <Section title="Tips" icon={<CheckCircle2 size={13} />}>
          <ul className="space-y-2 text-[11px]">
            {[
              <>Use <strong>modules</strong> to organize complex circuits into reusable blocks.</>,
              <>Signal names are case-sensitive: <Kbd>Sum</Kbd> ≠ <Kbd>sum</Kbd>.</>,
              <>Every signal must be defined before use (as INPUT or gate output).</>,
              <>The <strong>Analysis</strong> tab shows derived Boolean expressions for all outputs.</>,
              <>Truth tables auto-generate for circuits with ≤10 inputs.</>,
              <>Use the <strong>Dimensions</strong> panel to customize node sizes and spacing.</>,
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: p.accent }} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
