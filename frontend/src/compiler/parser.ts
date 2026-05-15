// ============================================================
// LogicSVG Pro — Recursive Descent Parser
// ============================================================
import type {
  Token, TokenType, ParsedCircuit, ModuleDefinition,
  Statement, InputStatement, OutputStatement, GateStatement,
  ModuleInstStatement, ASTExpression, GateType, Diagnostic
} from '@/types';
import { tokenize } from './lexer';

const GATE_TYPES = new Set<string>([
  'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF',
  'DFF', 'JKFF', 'TFF'
]);

function isGateType(name: string): name is GateType {
  return GATE_TYPES.has(name.toUpperCase());
}

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  public diagnostics: Diagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== 'COMMENT');
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF' as TokenType, value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const t = this.peek();
    if (t.type !== 'EOF') this.pos++;
    return t;
  }

  private expect(type: TokenType, context?: string): Token {
    const t = this.peek();
    if (t.type !== type) {
      this.diagnostics.push({
        severity: 'error',
        message: `Expected ${type}${context ? ' ' + context : ''}, got '${t.value}' (${t.type})`,
        line: t.line,
        col: t.col,
      });
      return t;
    }
    return this.advance();
  }

  private skipNewlines(): void {
    while (this.peek().type === 'NEWLINE') this.advance();
  }

  parse(): ParsedCircuit {
    const modules: ModuleDefinition[] = [];
    const statements: Statement[] = [];

    this.skipNewlines();

    while (this.peek().type !== 'EOF') {
      this.skipNewlines();
      if (this.peek().type === 'EOF') break;

      const t = this.peek();

      if (t.type === 'MODULE') {
        const mod = this.parseModule();
        if (mod) modules.push(mod);
      } else if (t.type === 'INPUT') {
        const stmt = this.parseInput();
        if (stmt) statements.push(stmt);
      } else if (t.type === 'OUTPUT') {
        const stmt = this.parseOutput();
        if (stmt) statements.push(stmt);
      } else if (t.type === 'IDENTIFIER') {
        const stmt = this.parseAssignment();
        if (stmt) statements.push(stmt);
      } else {
        this.diagnostics.push({
          severity: 'error',
          message: `Unexpected token '${t.value}'`,
          line: t.line,
          col: t.col,
        });
        this.advance();
      }
    }

    return { modules, statements };
  }

  private parseModule(): ModuleDefinition | null {
    const start = this.expect('MODULE');
    const nameToken = this.expect('IDENTIFIER', 'for module name');
    this.expect('LPAREN', 'for module inputs');

    const inputs: string[] = [];
    if (this.peek().type !== 'RPAREN') {
      inputs.push(this.expect('IDENTIFIER', 'for input name').value);
      while (this.peek().type === 'COMMA') {
        this.advance();
        inputs.push(this.expect('IDENTIFIER', 'for input name').value);
      }
    }
    this.expect('RPAREN', 'after module inputs');

    this.expect('ARROW', 'between inputs and outputs');
    this.expect('LPAREN', 'for module outputs');

    const outputs: string[] = [];
    if (this.peek().type !== 'RPAREN') {
      outputs.push(this.expect('IDENTIFIER', 'for output name').value);
      while (this.peek().type === 'COMMA') {
        this.advance();
        outputs.push(this.expect('IDENTIFIER', 'for output name').value);
      }
    }
    this.expect('RPAREN', 'after module outputs');

    this.expect('LBRACE', 'for module body');
    this.skipNewlines();

    const body: Statement[] = [];
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipNewlines();
      if (this.peek().type === 'RBRACE') break;

      const t = this.peek();
      if (t.type === 'INPUT') {
        const stmt = this.parseInput();
        if (stmt) body.push(stmt);
      } else if (t.type === 'OUTPUT') {
        const stmt = this.parseOutput();
        if (stmt) body.push(stmt);
      } else if (t.type === 'IDENTIFIER') {
        const stmt = this.parseAssignment();
        if (stmt) body.push(stmt);
      } else {
        this.diagnostics.push({
          severity: 'error',
          message: `Unexpected token '${t.value}' in module body`,
          line: t.line,
          col: t.col,
        });
        this.advance();
      }
    }

    this.expect('RBRACE', 'to close module');
    this.skipNewlines();

    return {
      kind: 'module_def',
      name: nameToken.value,
      inputs,
      outputs,
      body,
      line: start.line,
      col: start.col,
    };
  }

  private parseInput(): InputStatement | null {
    const start = this.advance(); // consume INPUT
    const names: string[] = [];
    names.push(this.expect('IDENTIFIER', 'for input name').value);
    while (this.peek().type === 'COMMA') {
      this.advance();
      names.push(this.expect('IDENTIFIER', 'for input name').value);
    }
    this.skipNewlines();
    return { kind: 'input', names, line: start.line, col: start.col };
  }

  private parseOutput(): OutputStatement | null {
    const start = this.advance(); // consume OUTPUT
    const nameToken = this.expect('IDENTIFIER', 'for output name');

    let expression: ASTExpression | undefined;
    if (this.peek().type === 'EQUALS') {
      this.advance();
      expression = this.parseExpression();
    }

    this.skipNewlines();
    return { kind: 'output', name: nameToken.value, expression, line: start.line, col: start.col };
  }

  private parseAssignment(): Statement | null {
    // Could be:
    //  Identifier = Expression         -> GateStatement (single target)
    //  Id1, Id2 = ModuleName(args)     -> ModuleInstStatement (multi-target)
    const firstToken = this.advance(); // first identifier
    const names = [firstToken.value];

    // Check for comma-separated outputs (module instantiation)
    while (this.peek().type === 'COMMA') {
      this.advance();
      names.push(this.expect('IDENTIFIER', 'for output name').value);
    }

    this.expect('EQUALS', 'in assignment');

    // Multiple targets => must be module instantiation
    if (names.length > 1) {
      const moduleName = this.expect('IDENTIFIER', 'for module name').value;
      this.expect('LPAREN', 'for module arguments');
      const args: ASTExpression[] = [];
      if (this.peek().type !== 'RPAREN') {
        args.push(this.parseExpression());
        while (this.peek().type === 'COMMA') {
          this.advance();
          args.push(this.parseExpression());
        }
      }
      this.expect('RPAREN', 'after module arguments');
      this.skipNewlines();

      return {
        kind: 'module_inst',
        outputs: names,
        moduleName,
        args,
        line: firstToken.line,
        col: firstToken.col,
      } as ModuleInstStatement;
    }

    // Single target: could be gate call or identifier reference
    const exprToken = this.peek();

    if (exprToken.type === 'IDENTIFIER') {
      const name = exprToken.value;
      const upper = name.toUpperCase();

      // If it's a known gate type, parse as gate expression
      if (isGateType(upper)) {
        const expr = this.parseExpression();
        this.skipNewlines();
        return {
          kind: 'gate',
          target: names[0],
          expression: expr,
          line: firstToken.line,
          col: firstToken.col,
        } as GateStatement;
      }

      // Check if next token is '(' - if so, it's a module instantiation with single output
      if (this.tokens[this.pos + 1]?.type === 'LPAREN') {
        const modName = this.advance().value;
        this.expect('LPAREN', 'for module arguments');
        const args: ASTExpression[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN', 'after module arguments');
        this.skipNewlines();

        return {
          kind: 'module_inst',
          outputs: names,
          moduleName: modName,
          args,
          line: firstToken.line,
          col: firstToken.col,
        } as ModuleInstStatement;
      }

      // Simple identifier assignment: X = Y (wire/alias)
      const expr = this.parseExpression();
      this.skipNewlines();
      return {
        kind: 'gate',
        target: names[0],
        expression: { kind: 'gate_call', gateType: 'BUF', args: [expr], line: expr.line, col: expr.col },
        line: firstToken.line,
        col: firstToken.col,
      } as GateStatement;
    }

    // Fallback: parse as expression
    const expr = this.parseExpression();
    this.skipNewlines();
    return {
      kind: 'gate',
      target: names[0],
      expression: expr,
      line: firstToken.line,
      col: firstToken.col,
    } as GateStatement;
  }

  private parseExpression(): ASTExpression {
    const t = this.peek();

    if (t.type === 'IDENTIFIER') {
      const name = t.value;
      const upper = name.toUpperCase();

      if (isGateType(upper)) {
        this.advance(); // consume gate name
        this.expect('LPAREN', `for ${upper} arguments`);
        const args: ASTExpression[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN', `after ${upper} arguments`);

        return {
          kind: 'gate_call',
          gateType: upper as GateType,
          args,
          line: t.line,
          col: t.col,
        };
      }

      // Simple identifier reference
      this.advance();
      return {
        kind: 'identifier',
        name,
        line: t.line,
        col: t.col,
      };
    }

    this.diagnostics.push({
      severity: 'error',
      message: `Expected expression, got '${t.value}'`,
      line: t.line,
      col: t.col,
    });
    this.advance();

    return { kind: 'identifier', name: '__error__', line: t.line, col: t.col };
  }
}

export function parseHDL(source: string): { circuit: ParsedCircuit; diagnostics: Diagnostic[] } {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const circuit = parser.parse();
  return { circuit, diagnostics: parser.diagnostics };
}
