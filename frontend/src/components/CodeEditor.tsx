import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import type { Diagnostic } from '@/types';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  diagnostics: Diagnostic[];
}

// ─── HDL Syntax Highlighting ───

interface SyntaxColors {
  keyword: string;    // INPUT, OUTPUT, MODULE
  gate: string;       // AND, OR, NOT, XOR, etc.
  comment: string;    // # comments
  string: string;     // identifiers used as signals
  operator: string;   // =, ->, {, }, (, ), ,
  number: string;     // numeric literals
  variable: string;   // signal names
  plain: string;      // default text
  moduleName: string; // module names
}

function useSyntaxColors(): SyntaxColors {
  const { mode } = useTheme();
  if (mode === 'dark') {
    return {
      keyword: '#ff7b72',     // red/coral - keywords (INPUT, OUTPUT, MODULE)
      gate: '#79c0ff',        // blue - gate functions
      comment: '#8b949e',     // gray - comments
      string: '#a5d6ff',      // light blue - strings
      operator: '#c9d1d9',    // light gray - operators
      number: '#f0883e',      // orange - numbers
      variable: '#ffa657',    // amber/orange - signal names
      plain: '#c9d1d9',       // default
      moduleName: '#d2a8ff',  // purple - module names
    };
  }
  return {
    keyword: '#a626a4',     // purple
    gate: '#4078f2',        // blue
    comment: '#a0a1a7',     // gray
    string: '#50a14f',      // green
    operator: '#383a42',    // dark
    number: '#986801',      // orange
    variable: '#c18401',    // yellow/amber
    plain: '#383a42',       // default
    moduleName: '#e45649',  // red
  };
}

const KEYWORDS = new Set(['INPUT', 'OUTPUT', 'MODULE']);
const GATES = new Set(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF', 'DFF', 'TFF', 'MUX', 'DMUX']);

function highlightLine(line: string, colors: SyntaxColors): string {
  // Comment line
  if (line.trimStart().startsWith('#')) {
    return `<span style="color:${colors.comment};font-style:italic">${escapeHtml(line)}</span>`;
  }

  let result = '';
  let i = 0;

  while (i < line.length) {
    // Whitespace
    if (line[i] === ' ' || line[i] === '\t') {
      result += line[i];
      i++;
      continue;
    }

    // Operators and punctuation
    if ('=(){},->'.includes(line[i])) {
      // Check for ->
      if (line[i] === '-' && line[i + 1] === '>') {
        result += `<span style="color:${colors.operator}">-&gt;</span>`;
        i += 2;
        continue;
      }
      result += `<span style="color:${colors.operator}">${escapeHtml(line[i])}</span>`;
      i++;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i])) {
      let num = '';
      while (i < line.length && /\d/.test(line[i])) {
        num += line[i];
        i++;
      }
      result += `<span style="color:${colors.number}">${num}</span>`;
      continue;
    }

    // Words (identifiers, keywords, gates)
    if (/[a-zA-Z_]/.test(line[i])) {
      let word = '';
      while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) {
        word += line[i];
        i++;
      }

      if (KEYWORDS.has(word)) {
        result += `<span style="color:${colors.keyword};font-weight:600">${word}</span>`;
      } else if (GATES.has(word)) {
        result += `<span style="color:${colors.gate}">${word}</span>`;
      } else if (word[0] === word[0].toUpperCase() && word.length > 1 && /[a-z]/.test(word)) {
        // PascalCase = module name
        result += `<span style="color:${colors.moduleName}">${word}</span>`;
      } else {
        result += `<span style="color:${colors.variable}">${word}</span>`;
      }
      continue;
    }

    // Inline comment
    if (line[i] === '#') {
      const rest = line.substring(i);
      result += `<span style="color:${colors.comment};font-style:italic">${escapeHtml(rest)}</span>`;
      break;
    }

    // Other characters
    result += escapeHtml(line[i]);
    i++;
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function CodeEditor({ code, onChange, diagnostics }: CodeEditorProps) {
  const { palette: p } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const syntaxColors = useSyntaxColors();

  const errorLines = new Set(diagnostics.filter(d => d.severity === 'error').map(d => d.line));
  const lineNumbers = code.split('\n').map((_, i) => i + 1);

  // Generate highlighted HTML
  const highlightedHtml = useMemo(() => {
    const lines = code.split('\n');
    return lines.map(line => highlightLine(line, syntaxColors)).join('\n');
  }, [code, syntaxColors]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = target.value.substring(0, start) + '  ' + target.value.substring(end);
      onChange(newValue);
      setTimeout(() => { target.selectionStart = target.selectionEnd = start + 2; }, 0);
    }
  }, [onChange]);

  const updateCursor = useCallback(() => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      setCursorLine(textareaRef.current.value.substring(0, pos).split('\n').length);
    }
  }, []);

  useEffect(() => { updateCursor(); }, [code, updateCursor]);

  return (
    <div className="flex h-full font-mono text-[12.5px] leading-[1.75]">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 w-11 overflow-hidden select-none text-right pr-3 pt-3 pb-3"
        style={{ background: p.bgInset }}
      >
        {lineNumbers.map(num => (
          <div
            key={num}
            className="text-[11px]"
            style={{
              height: '1.75em',
              lineHeight: '1.75',
              color: errorLines.has(num) ? p.error : (num === cursorLine ? p.textSecondary : p.textFaint),
              fontWeight: errorLines.has(num) ? 700 : 400,
            }}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Editor area with highlight overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* Highlighted code (behind textarea) */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 px-3 py-3 whitespace-pre overflow-auto pointer-events-none m-0"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12.5px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            color: 'transparent',
          }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
        />

        {/* Transparent textarea (on top for editing) */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleInput}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          spellCheck={false}
          className="absolute inset-0 w-full h-full resize-none outline-none px-3 py-3 whitespace-pre overflow-auto"
          style={{
            background: 'transparent',
            color: 'transparent',
            caretColor: p.accent,
            tabSize: 2,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12.5px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            WebkitTextFillColor: 'transparent',
          }}
          placeholder={"# Write your HDL code here...\n\nINPUT A, B\nC = AND(A, B)\nOUTPUT C"}
        />
      </div>
    </div>
  );
}
