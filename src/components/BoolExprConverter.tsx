import { useState, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ArrowRight, Copy, Check, Wand2 } from 'lucide-react';

// Parse boolean expression like "a + b · ¬c = d" into HDL
// Supports: + (OR), · * (AND), ¬ ! ~ (NOT), ^ ⊕ (XOR), () grouping
// Format: expr = output_name  OR  output_name = expr

function tokenizeExpr(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (' \t'.includes(c)) { i++; continue; }
    if ('()+·*^⊕¬!~,='.includes(c)) { tokens.push(c); i++; continue; }
    if (c === "'") { tokens.push('NOT_POST'); i++; continue; }
    // multi-char identifiers
    let word = '';
    while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
      word += input[i]; i++;
    }
    if (word) tokens.push(word);
  }
  return tokens;
}

interface ExprNode {
  type: 'var' | 'not' | 'and' | 'or' | 'xor';
  name?: string;
  children?: ExprNode[];
}

function parseExprTokens(tokens: string[]): { expr: ExprNode; pos: number } {
  let pos = 0;

  function peek(): string | undefined { return tokens[pos]; }
  function advance(): string { return tokens[pos++]; }

  function parseAtom(): ExprNode {
    const t = peek();
    if (!t) return { type: 'var', name: '?' };

    if (t === '¬' || t === '!' || t === '~') {
      advance();
      const inner = parseAtom();
      return { type: 'not', children: [inner] };
    }
    if (t === '(') {
      advance(); // (
      const inner = parseOr();
      if (peek() === ')') advance();
      return inner;
    }
    // identifier
    advance();
    let node: ExprNode = { type: 'var', name: t };
    // post-fix NOT: A'
    if (peek() === 'NOT_POST') {
      advance();
      node = { type: 'not', children: [node] };
    }
    return node;
  }

  function parseAnd(): ExprNode {
    let left = parseAtom();
    while (peek() === '·' || peek() === '*') {
      advance();
      const right = parseAtom();
      left = { type: 'and', children: [left, right] };
    }
    // implicit AND: two atoms next to each other without operator (e.g. AB)
    while (peek() && peek() !== '+' && peek() !== ')' && peek() !== '=' && peek() !== ',' && peek() !== '^' && peek() !== '⊕') {
      if (peek() === '·' || peek() === '*') { advance(); }
      const next = peek();
      if (!next || next === '+' || next === ')' || next === '=' || next === ',') break;
      const right = parseAtom();
      left = { type: 'and', children: [left, right] };
    }
    return left;
  }

  function parseXor(): ExprNode {
    let left = parseAnd();
    while (peek() === '^' || peek() === '⊕') {
      advance();
      const right = parseAnd();
      left = { type: 'xor', children: [left, right] };
    }
    return left;
  }

  function parseOr(): ExprNode {
    let left = parseXor();
    while (peek() === '+') {
      advance();
      const right = parseXor();
      left = { type: 'or', children: [left, right] };
    }
    return left;
  }

  const expr = parseOr();
  return { expr, pos };
}

function exprToHDL(node: ExprNode, varCounter: { n: number }, lines: string[]): string {
  if (node.type === 'var') return node.name ?? '?';
  if (node.type === 'not' && node.children) {
    const inner = exprToHDL(node.children[0], varCounter, lines);
    const name = `_t${varCounter.n++}`;
    lines.push(`${name} = NOT(${inner})`);
    return name;
  }
  const gate = node.type.toUpperCase();
  const args = (node.children ?? []).map(c => exprToHDL(c, varCounter, lines));
  const name = `_t${varCounter.n++}`;
  lines.push(`${name} = ${gate}(${args.join(', ')})`);
  return name;
}

function convertBoolExprToHDL(input: string): string {
  const rawLines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const allInputs = new Set<string>();
  const outputDefs: { name: string; exprStr: string }[] = [];

  for (const line of rawLines) {
    // Find = sign for assignment
    const eqIdx = line.indexOf('=');
    let outputName: string;
    let exprStr: string;

    if (eqIdx > 0) {
      // check if left side is a simple name
      const left = line.substring(0, eqIdx).trim();
      const right = line.substring(eqIdx + 1).trim();
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(left)) {
        outputName = left;
        exprStr = right;
      } else {
        outputName = `Out${outputDefs.length + 1}`;
        exprStr = line;
      }
    } else {
      outputName = `Out${outputDefs.length + 1}`;
      exprStr = line;
    }

    outputDefs.push({ name: outputName, exprStr });
  }

  const hdlLines: string[] = [];
  const outputs: string[] = [];

  for (const { name, exprStr } of outputDefs) {
    const tokens = tokenizeExpr(exprStr);
    const { expr } = parseExprTokens(tokens);

    // Collect variable names
    function collectVars(node: ExprNode) {
      if (node.type === 'var' && node.name) allInputs.add(node.name);
      node.children?.forEach(collectVars);
    }
    collectVars(expr);

    const gateLines: string[] = [];
    const counter = { n: 1 };
    exprToHDL(expr, counter, gateLines);

    hdlLines.push(...gateLines);
    // Rename the last temp to the output name
    if (gateLines.length > 0) {
      const last = gateLines[gateLines.length - 1];
      const tempName = last.split('=')[0].trim();
      // Replace all occurrences of tempName in subsequent lines
      for (let i = 0; i < hdlLines.length; i++) {
        hdlLines[i] = hdlLines[i].replace(new RegExp(`\\b${tempName}\\b`, 'g'), name);
      }
    }
    outputs.push(name);
  }

  // Remove outputs from inputs
  for (const out of outputs) allInputs.delete(out);
  // Also remove any temp vars from inputs
  for (const inp of [...allInputs]) {
    if (inp.startsWith('_t')) allInputs.delete(inp);
  }

  const result: string[] = [];
  if (allInputs.size > 0) {
    result.push(`INPUT ${[...allInputs].sort().join(', ')}`);
    result.push('');
  }
  result.push(...hdlLines);
  result.push('');
  for (const out of outputs) {
    result.push(`OUTPUT ${out}`);
  }

  return result.join('\n');
}

interface BoolExprConverterProps {
  onInsertCode: (code: string) => void;
}

export default function BoolExprConverter({ onInsertCode }: BoolExprConverterProps) {
  const { palette: p } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleConvert = useCallback(() => {
    if (!input.trim()) return;
    try {
      const hdl = convertBoolExprToHDL(input);
      setOutput(hdl);
    } catch {
      setOutput('# Error parsing expression');
    }
  }, [input]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const handleInsert = useCallback(() => {
    if (output) onInsertCode(output);
  }, [output, onInsertCode]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <div>
          <p className="text-[11px] font-bold" style={{ color: p.textPrimary }}>
            Bool → HDL
          </p>
          <p className="text-[9px]" style={{ color: p.textFaint }}>
            Convert boolean expressions to circuit code
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {/* Syntax help */}
        <div className="text-[10px] p-2 rounded" style={{ background: p.bgInset, color: p.textMuted }}>
          <p className="font-semibold mb-0.5" style={{ color: p.textSecondary }}>Syntax:</p>
          <p><code style={{ color: p.success }}>+</code> OR · <code style={{ color: p.success }}>·</code> or <code style={{ color: p.success }}>*</code> AND · <code style={{ color: p.success }}>!</code> or <code style={{ color: p.success }}>¬</code> NOT · <code style={{ color: p.success }}>^</code> XOR</p>
          <p className="mt-0.5">
            Example: <code style={{ color: p.accent }}>D = A · B + ¬C</code>
          </p>
          <p>
            Or multi-line: one expression per line.
          </p>
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={"D = A · B + ¬C\nE = A ^ B"}
          rows={4}
          className="w-full text-[11px] font-mono p-2 rounded resize-none outline-none"
          style={{
            background: p.bgInset, color: p.textPrimary,
            border: `1px solid ${p.borderSubtle}`,
          }}
        />

        <button onClick={handleConvert}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white w-full justify-center"
          style={{ background: p.accent }}>
          <ArrowRight size={12} /> Convert to HDL
        </button>

        {/* Output */}
        {output && (
          <div className="relative">
            <pre className="text-[10px] font-mono p-2 rounded whitespace-pre-wrap leading-relaxed"
              style={{ background: p.bgInset, color: p.success, border: `1px solid ${p.borderSubtle}` }}>
              {output}
            </pre>
            <div className="flex gap-1 mt-1.5">
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                style={{ background: p.bgElevated, color: p.textSecondary, border: `1px solid ${p.border}` }}>
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handleInsert}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-white"
                style={{ background: p.accent }}>
                Insert into editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
