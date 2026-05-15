// ============================================================
// LogicSVG Pro — Core Type Definitions
// ============================================================

// -- Token Types for Lexer --
export type TokenType =
  | 'MODULE' | 'INPUT' | 'OUTPUT'
  | 'IDENTIFIER' | 'LPAREN' | 'RPAREN'
  | 'LBRACE' | 'RBRACE' | 'COMMA' | 'EQUALS'
  | 'ARROW' | 'COMMENT' | 'EOF' | 'NEWLINE';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// -- AST Node Types --
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'BUF'
  | 'DFF' | 'JKFF' | 'TFF';

export interface ASTExpression {
  kind: 'gate_call' | 'identifier';
  gateType?: GateType;
  args?: ASTExpression[];
  name?: string;
  line: number;
  col: number;
}

export interface InputStatement {
  kind: 'input';
  names: string[];
  line: number;
  col: number;
}

export interface OutputStatement {
  kind: 'output';
  name: string;
  expression?: ASTExpression;
  line: number;
  col: number;
}

export interface GateStatement {
  kind: 'gate';
  target: string;
  expression: ASTExpression;
  line: number;
  col: number;
}

export interface ModuleInstStatement {
  kind: 'module_inst';
  outputs: string[];
  moduleName: string;
  args: ASTExpression[];
  line: number;
  col: number;
}

export interface ModuleDefinition {
  kind: 'module_def';
  name: string;
  inputs: string[];
  outputs: string[];
  body: Statement[];
  line: number;
  col: number;
}

export type Statement = InputStatement | OutputStatement | GateStatement | ModuleInstStatement;

export interface ParsedCircuit {
  modules: ModuleDefinition[];
  statements: Statement[];
}

// -- Compiler Diagnostics --
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  col: number;
}

// -- Graph / Circuit Representation --
export type CircuitNodeKind = 'input' | 'output' | 'gate' | 'module';

export interface CircuitNode {
  id: string;
  kind: CircuitNodeKind;
  gateType?: GateType;
  label: string;
  inputs: string[];  // IDs of source nodes
  inputLabels?: string[]; // Pin labels for inputs
  outputs: string[]; // IDs of destination nodes
  outputLabels?: string[]; // Pin labels for outputs
  moduleName?: string;
  moduleInputs?: string[];
  moduleOutputs?: string[];
}

export interface CircuitGraph {
  nodes: Map<string, CircuitNode>;
  inputIds: string[];
  outputIds: string[];
}

// -- Simulation State --
export type LogicValue = boolean;

export interface SimulationState {
  values: Map<string, LogicValue>;
  evaluationOrder: string[];
}

// -- Layout Types --
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  label: string;
  kind: CircuitNodeKind;
  gateType?: GateType;
  inputPins: PinPosition[];
  outputPins: PinPosition[];
}

export interface PinPosition {
  x: number;
  y: number;
  label: string;
  nodeId: string;
}

export interface WireSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Wire {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPin: PinPosition;
  toPin: PinPosition;
  segments: WireSegment[];
  value?: LogicValue;
}

export interface CircuitLayout {
  nodes: LayoutNode[];
  wires: Wire[];
  width: number;
  height: number;
}

// -- Truth Table --
export interface TruthTableRow {
  inputs: Map<string, boolean>;
  outputs: Map<string, boolean>;
}

export interface TruthTable {
  inputNames: string[];
  outputNames: string[];
  rows: TruthTableRow[];
}

// -- Export Types --
export type ExportFormat = 'svg' | 'png' | 'pdf';

// -- App State --
export interface AppState {
  code: string;
  parsedCircuit: ParsedCircuit | null;
  graph: CircuitGraph | null;
  layout: CircuitLayout | null;
  simulation: SimulationState | null;
  diagnostics: Diagnostic[];
  truthTable: TruthTable | null;
}
