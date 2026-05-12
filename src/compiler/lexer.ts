// ============================================================
// LogicSVG Pro — Lexer (Tokenizer)
// ============================================================
import type { Token, TokenType } from '@/types';

const KEYWORDS: Record<string, TokenType> = {
  MODULE: 'MODULE',
  INPUT: 'INPUT',
  OUTPUT: 'OUTPUT',
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  const peek = (): string => (pos < source.length ? source[pos] : '\0');
  const advance = (): string => {
    const ch = source[pos];
    pos++;
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  };

  while (pos < source.length) {
    const ch = peek();

    // Skip whitespace (not newlines)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    // Newlines
    if (ch === '\n') {
      tokens.push({ type: 'NEWLINE', value: '\n', line, col });
      advance();
      continue;
    }

    // Comments
    if (ch === '#') {
      const startCol = col;
      const startLine = line;
      let comment = '';
      while (pos < source.length && peek() !== '\n') {
        comment += advance();
      }
      tokens.push({ type: 'COMMENT', value: comment, line: startLine, col: startCol });
      continue;
    }

    // Arrow ->
    if (ch === '-' && pos + 1 < source.length && source[pos + 1] === '>') {
      tokens.push({ type: 'ARROW', value: '->', line, col });
      advance();
      advance();
      continue;
    }

    // Single char tokens
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(', line, col }); advance(); continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')', line, col }); advance(); continue; }
    if (ch === '{') { tokens.push({ type: 'LBRACE', value: '{', line, col }); advance(); continue; }
    if (ch === '}') { tokens.push({ type: 'RBRACE', value: '}', line, col }); advance(); continue; }
    if (ch === ',') { tokens.push({ type: 'COMMA', value: ',', line, col }); advance(); continue; }
    if (ch === '=') { tokens.push({ type: 'EQUALS', value: '=', line, col }); advance(); continue; }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      const startCol = col;
      const startLine = line;
      let word = '';
      while (pos < source.length && /[a-zA-Z0-9_]/.test(peek())) {
        word += advance();
      }
      const upper = word.toUpperCase();
      const type: TokenType = KEYWORDS[upper] ?? 'IDENTIFIER';
      tokens.push({ type, value: type === 'IDENTIFIER' ? word : upper, line: startLine, col: startCol });
      continue;
    }

    // Unknown character - skip
    advance();
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}
