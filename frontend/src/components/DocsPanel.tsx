import { useTheme } from '@/context/ThemeContext';
import {
  BookOpen, ChevronRight, Terminal, Layers, ArrowRight,
  Cpu, Zap, Lightbulb, CheckCircle2, Copy, Check
} from 'lucide-react';
import { useState, useCallback } from 'react';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const FULL_DOCUMENTATION = `
LOGICSVG DOCUMENTATION

QUICK START

Write digital circuits using a simple HDL. The compiler parses your code,
builds a graph, and renders a schematic instantly.

Minimal Example:

INPUT A, B
C = AND(A, B)
OUTPUT C

Click any INPUT node on the schematic to toggle its value and see the
simulation update in real time.

────────────────────────────────────────

SYNTAX REFERENCE

1. INPUTS

INPUT A, B, Cin

Declares clickable input signals.

2. OUTPUTS

OUTPUT Sum
OUTPUT Cout = OR(C1, C2)

Declares output signals.

3. GATE ASSIGNMENTS

X = AND(A, B)
Y = OR(X, NOT(C))

Assign gate outputs to wires.

4. MODULES

Definition:

MODULE HalfAdder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}

Instantiation:

S1, C1 = HalfAdder(A, B)

Reusable subcircuits.

5. COMMENTS

# This is a comment

────────────────────────────────────────

SUPPORTED GATES

AND   - Logical AND
OR    - Logical OR
NOT   - Inverter
NAND  - NOT-AND
NOR   - NOT-OR
XOR   - Exclusive OR
XNOR  - Exclusive NOR
BUF   - Buffer
DFF   - D Flip-Flop
TFF   - T Flip-Flop

────────────────────────────────────────

EXAMPLES

FULL ADDER

MODULE HalfAdder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}

INPUT A, B, Cin

S1, C1 = HalfAdder(A, B)
Sum, C2 = HalfAdder(S1, Cin)
Cout = OR(C1, C2)

OUTPUT Sum
OUTPUT Cout

────────────────────────────────────────

2:1 MULTIPLEXER

INPUT A, B, Sel

NotSel = NOT(Sel)
TermA = AND(A, NotSel)
TermB = AND(B, Sel)

Out = OR(TermA, TermB)

OUTPUT Out

────────────────────────────────────────

TIPS

- Use modules to organize complex circuits.
- Signal names are case-sensitive.
- Every signal must be defined before use.
- Truth tables auto-generate for ≤10 inputs.
- Use the Dimensions panel to customize spacing and node sizes.
`;

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { palette: p } = useTheme();

  return (
    <div
      className="mb-1.5 rounded-lg overflow-hidden"
      style={{ border: `1px solid ${p.borderSubtle}` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
        style={{ background: p.bgSurface }}
        onMouseEnter={e => (e.currentTarget.style.background = p.bgHover)}
        onMouseLeave={e => (e.currentTarget.style.background = p.bgSurface)}
      >
        <span style={{ color: p.accent }}>{icon}</span>

        <span
          className="text-[12px] font-semibold"
          style={{ color: p.textPrimary }}
        >
          {title}
        </span>

        <ChevronRight
          size={13}
          className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`}
          style={{ color: p.textFaint }}
        />
      </button>

      {open && (
        <div
          className="px-3.5 py-3 text-[12px] leading-relaxed"
          style={{ color: p.textSecondary }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { palette: p } = useTheme();

  return (
    <div
      className="my-2.5 rounded-md overflow-hidden"
      style={{ border: `1px solid ${p.borderSubtle}` }}
    >
      {label && (
        <div
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: p.bgSurface,
            color: p.textFaint
          }}
        >
          {label}
        </div>
      )}

      <pre
        className="p-2.5 overflow-x-auto text-[10.5px] font-mono leading-relaxed"
        style={{
          background: p.bgInset,
          color: p.success
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  const { palette: p } = useTheme();

  return (
    <code
      className="px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{
        background: p.bgElevated,
        color: p.warning
      }}
    >
      {children}
    </code>
  );
}

export default function DocsPanel() {
  const { palette: p } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(FULL_DOCUMENTATION);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);

    } catch (err) {
      console.error('Clipboard error:', err);
    }
  }, []);

  return (
    <div className="h-full flex flex-col">

      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: `1px solid ${p.borderSubtle}`
        }}
      >
        <div className="flex items-center gap-2.5">
          <BookOpen size={16} style={{ color: p.accent }} />

          <div>
            <h2
              className="text-[12px] font-bold"
              style={{ color: p.textPrimary }}
            >
              Documentation
            </h2>

            <p
              className="text-[10px]"
              style={{ color: p.textFaint }}
            >
              HDL syntax reference
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{
            background: p.bgElevated,
            color: copied ? p.success : p.textMuted,
            border: `1px solid ${p.borderSubtle}`
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}

          {copied ? 'Copied!' : 'Copy all'}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">

        <Section
          title="Quick Start"
          icon={<Zap size={13} />}
          defaultOpen={true}
        >
          <p className="mb-2">
            Write digital circuits using a simple HDL.
          </p>

          <CodeBlock
            label="Minimal example"
            code={`INPUT A, B
C = AND(A, B)
OUTPUT C`}
          />
        </Section>

        <Section
          title="Syntax Reference"
          icon={<Terminal size={13} />}
        >
          <CodeBlock code={`X = AND(A, B)
Y = OR(X, NOT(C))`} />
        </Section>

        <Section
          title="Supported Gates"
          icon={<Cpu size={13} />}
        >
          <p>AND, OR, NOT, NAND, NOR, XOR, XNOR, BUF, DFF, TFF</p>
        </Section>

        <Section
          title="Examples"
          icon={<Layers size={13} />}
        >
          <CodeBlock
            code={`INPUT A, B
C = AND(A, B)
OUTPUT C`}
          />
        </Section>

        <Section
          title="Tips"
          icon={<CheckCircle2 size={13} />}
        >
          <ul className="space-y-2 text-[11px]">
            <li className="flex items-start gap-2">
              <ArrowRight
                size={11}
                className="flex-shrink-0 mt-0.5"
                style={{ color: p.accent }}
              />
              <span>
                Signal names are case-sensitive:
                <Kbd>Sum</Kbd> ≠ <Kbd>sum</Kbd>
              </span>
            </li>
          </ul>
        </Section>

      </div>
    </div>
  );
}