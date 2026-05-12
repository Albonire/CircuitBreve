# LogicSVG - Project Documentation

Complete technical reference for the LogicSVG circuit simulator. Covers architecture, compilation pipeline, algorithms, component structure, theming, and implementation details.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Compilation Pipeline](#compilation-pipeline)
3. [Type System](#type-system)
4. [Compiler](#compiler)
5. [Graph Builder](#graph-builder)
6. [Layout Engine](#layout-engine)
7. [Simulator](#simulator)
8. [Boolean Expression Extractor](#boolean-expression-extractor)
9. [UI Components](#ui-components)
10. [Hooks](#hooks)
11. [Theming](#theming)
12. [Export System](#export-system)
13. [Configuration and Dimensions](#configuration-and-dimensions)
14. [File Reference](#file-reference)

---

## Architecture Overview

The application follows a unidirectional data flow:

```
HDL Source Code
     |
     v
  [Lexer]  -->  Token[]
     |
     v
  [Parser]  -->  ParsedCircuit (AST)
     |
     v
  [Graph Builder]  -->  CircuitGraph (nodes + edges)
     |
     v
  [Layout Engine]  -->  CircuitLayout (positioned nodes + routed wires)
     |
     v
  [Simulator]  -->  SimulationState (logic values per node)
     |
     v
  [Renderer]  -->  Interactive SVG
```

The `useCircuit` hook orchestrates this pipeline. On every code change (with 400ms debounce), the full pipeline re-executes. The simulation also runs independently when inputs are toggled.

### Key Design Decisions

- No external graph or circuit libraries. All algorithms (layout, simulation, parsing) are implemented from scratch.
- Single-file build output via `vite-plugin-singlefile` for easy distribution.
- Inline styles for theme colors (not Tailwind color classes) to support dynamic theme switching without CSS variable overhead.
- SVG rendering (not Canvas) for resolution independence and export quality.

---

## Compilation Pipeline

### Step 1: Lexing (src/compiler/lexer.ts)

Hand-written scanner that produces tokens with line/column tracking.

**Token Types:**
- Keywords: `MODULE`, `INPUT`, `OUTPUT`
- Identifiers: any `[a-zA-Z_][a-zA-Z0-9_]*`
- Punctuation: `(`, `)`, `{`, `}`, `,`, `=`, `->`
- Structural: `NEWLINE`, `COMMENT`, `EOF`

**Behavior:**
- Whitespace (spaces, tabs, carriage returns) is skipped
- Newlines are preserved as tokens (statement separators)
- Comments start with `#` and extend to end of line
- Keywords are case-insensitive during lexing (stored uppercase)
- Identifiers preserve their original case

### Step 2: Parsing (src/compiler/parser.ts)

Recursive descent parser producing a `ParsedCircuit` AST.

**Grammar (informal):**
```
Circuit     = (Module | Statement)*
Module      = 'MODULE' IDENT '(' params ')' '->' '(' params ')' '{' Statement* '}'
Statement   = Input | Output | Assignment
Input       = 'INPUT' IDENT (',' IDENT)*
Output      = 'OUTPUT' IDENT ('=' Expression)?
Assignment  = IDENT (',' IDENT)* '=' Expression
Expression  = GateCall | ModuleCall | IDENT
GateCall    = GATE_TYPE '(' Expression (',' Expression)* ')'
```

**Supported gate types:** AND, OR, NOT, NAND, NOR, XOR, XNOR, BUF, DFF, JKFF, TFF

**Parser features:**
- Multi-output assignments: `S, C = HalfAdder(A, B)`
- Nested expressions: `X = OR(AND(A, B), NOT(C))`
- Inline output expressions: `OUTPUT X = AND(A, B)`
- Wire aliases: `X = Y` (compiled as BUF gate)
- Error recovery: continues parsing after errors, collecting diagnostics

### Step 3: Graph Building (src/compiler/graphBuilder.ts)

Flattens the AST into a flat `CircuitGraph` by resolving module instantiations.

**Process:**
1. Register all module definitions in a lookup map
2. Process top-level statements sequentially
3. For each module instantiation:
   - Create a sub-context with a unique prefix
   - Map module formal parameters to actual argument node IDs
   - Process module body statements in the sub-context
   - Map module output names back to the caller's namespace
4. Gate expressions create new `CircuitNode` entries with input/output edges
5. Undefined signals generate error diagnostics and phantom input nodes

**Name resolution:** Uses a `nameMap: Map<string, string>` that maps signal names to node IDs. Module instantiations create isolated sub-contexts to avoid name collisions.

---

## Type System

Defined in `src/types/index.ts`.

### Token Types

```typescript
type TokenType = 'MODULE' | 'INPUT' | 'OUTPUT' | 'IDENTIFIER' | 'LPAREN' | 'RPAREN'
  | 'LBRACE' | 'RBRACE' | 'COMMA' | 'EQUALS' | 'ARROW' | 'COMMENT' | 'EOF' | 'NEWLINE';
```

### AST Types

```typescript
interface ASTExpression {
  kind: 'gate_call' | 'identifier';
  gateType?: GateType;
  args?: ASTExpression[];
  name?: string;
  line: number; col: number;
}

type Statement = InputStatement | OutputStatement | GateStatement | ModuleInstStatement;
```

### Circuit Graph

```typescript
interface CircuitNode {
  id: string;
  kind: 'input' | 'output' | 'gate' | 'module';
  gateType?: GateType;
  label: string;
  inputs: string[];   // source node IDs
  outputs: string[];  // destination node IDs
}

interface CircuitGraph {
  nodes: Map<string, CircuitNode>;
  inputIds: string[];
  outputIds: string[];
}
```

### Layout Types

```typescript
interface LayoutNode {
  id: string;
  x: number; y: number;
  width: number; height: number;
  layer: number;
  label: string;
  kind: CircuitNodeKind;
  gateType?: GateType;
  inputPins: PinPosition[];
  outputPins: PinPosition[];
}

interface Wire {
  id: string;
  fromNodeId: string; toNodeId: string;
  fromPin: PinPosition; toPin: PinPosition;
  segments: WireSegment[];
}
```

### Simulation

```typescript
interface SimulationState {
  values: Map<string, LogicValue>;  // node ID -> boolean
  evaluationOrder: string[];
}
```

---

## Compiler

### Lexer Details

File: `src/compiler/lexer.ts`

The lexer is a single `tokenize(source: string): Token[]` function. It uses a position-based scanner with `peek()` and `advance()` helpers. Line and column are tracked for diagnostic reporting.

Special cases:
- The `->` arrow is a two-character token
- Keywords are detected by uppercasing identifiers and checking against a lookup table
- Unknown characters are silently skipped (no error token)

### Parser Details

File: `src/compiler/parser.ts`

The parser is a class with internal state (`tokens`, `pos`, `diagnostics`). Comments are filtered out before parsing begins.

Key methods:
- `parse()`: Top-level loop dispatching to module/input/output/assignment parsers
- `parseModule()`: Handles full module definition including body
- `parseAssignment()`: Disambiguates between gate calls, module instantiations, and wire aliases based on lookahead
- `parseExpression()`: Handles gate calls (recursive) and identifier references

Error handling: The parser uses `expect()` which pushes a diagnostic on mismatch but does not throw. Parsing continues with best-effort recovery.

---

## Graph Builder

File: `src/compiler/graphBuilder.ts`

### Build Context

```typescript
interface BuildContext {
  graph: CircuitGraph;
  modules: Map<string, ModuleDefinition>;
  nameMap: Map<string, string>;  // signal name -> node ID
  diagnostics: Diagnostic[];
  counter: number;  // unique ID counter
  prefix: string;   // namespace prefix for module instances
}
```

### Module Instantiation

When a module is instantiated:
1. A new `BuildContext` is created with a unique prefix (e.g., `HalfAdder_5`)
2. Module input parameters are mapped to the caller's argument node IDs
3. The module body is processed in this sub-context
4. After processing, module output names are resolved from the sub-context and mapped back to the caller's namespace

This allows the same module to be instantiated multiple times without ID collisions.

### Node ID Generation

IDs follow the pattern: `{prefix}_{hint}_{counter}` where hint is typically the signal name or gate type.

---

## Layout Engine

File: `src/layout/layoutEngine.ts`

Implements a Sugiyama-style layered graph drawing algorithm in 5 steps.

### Step 1: Layer Assignment

Uses longest-path DFS. Each node's layer equals the maximum depth of its input chain. Inputs end up at layer 0, outputs at the deepest layer.

Handles cycles by tracking a `visiting` set and returning 0 for back-edges.

### Step 2: Group by Layer

Simple bucketing of nodes into arrays indexed by layer number.

### Step 3: Crossing Minimization

Barycenter heuristic with 6 forward+backward sweeps:
- Forward sweep: for each layer (left to right), sort nodes by the average position of their inputs in the previous layer
- Backward sweep: for each layer (right to left), sort nodes by the average position of their outputs in the next layer

### Step 4: Coordinate Assignment

Assigns (x, y) positions based on layer index and node order within layer:
- x = padding + layerIndex * layerGap
- y = padding + cumulative (nodeHeight + nodeGap)

Pin positions are calculated relative to node position:
- Input pins: distributed vertically on the left edge
- Output pins: centered vertically on the right edge
- For OR/XOR gates: input pins follow the concave curve of the gate shape

### Step 5: Wire Routing

Orthogonal routing with 3-segment paths:
1. Horizontal from source output pin to channel midpoint
2. Vertical through the channel
3. Horizontal from channel to destination input pin

Channel X position = midpoint between the right edge of the source layer and the left edge of the destination layer. Multiple wires sharing a channel are offset by 6px to avoid overlap.

Straight wires (same Y, adjacent layers) use a single horizontal segment.

### Configurable Parameters

```typescript
interface DimensionConfig {
  layerGap: number;      // horizontal distance between layers (default: 140)
  nodeGap: number;       // vertical gap between nodes (default: 60)
  padding: number;       // margin around circuit (default: 50)
  gateWidth: number;     // default gate width (default: 72)
  gateHeight: number;    // default gate height (default: 44)
  inputWidth: number;    // default input node width (default: 68)
  inputHeight: number;   // default input node height (default: 36)
  outputWidth: number;   // default output node width (default: 68)
  outputHeight: number;  // default output node height (default: 36)
  nodeOverrides: Map<string, { width: number; height: number }>;
}
```

---

## Simulator

File: `src/simulator/simulator.ts`

### Simulation Algorithm

1. Topological sort using Kahn's algorithm (BFS from zero in-degree nodes)
2. If a cycle is detected (not all nodes processed), remaining nodes are appended with a warning
3. Input values are set from the provided `inputValues` map
4. Nodes are evaluated in topological order:
   - Input nodes: use provided value
   - Gate nodes: evaluate gate function on input values
   - Output nodes: pass through their single input

### Gate Evaluation

```typescript
function evaluateGate(gateType: string, inputs: LogicValue[]): LogicValue
```

| Gate | Logic |
|------|-------|
| AND | All inputs true |
| OR | Any input true |
| NOT | Invert single input |
| BUF | Pass through |
| NAND | NOT(AND) |
| NOR | NOT(OR) |
| XOR | Odd number of true inputs |
| XNOR | NOT(XOR) |
| DFF/TFF/JKFF | Pass through D input (simplified) |

### Truth Table Generation

Iterates all 2^n input combinations (capped at 256 rows for performance). For each combination, runs a full simulation and records output values.

Export: `exportTruthTableCSV()` produces a comma-separated string with headers.

---

## Boolean Expression Extractor

File: `src/simulator/booleanExpr.ts`

Recursively traverses the graph from output nodes backward to inputs, building symbolic expressions.

**Notation:**
- NOT: prefix `¬`
- AND: infix `·`
- OR: infix `+`
- XOR: infix `⊕`
- NAND: `¬(a · b)`
- NOR: `¬(a + b)`

Includes precedence-aware parenthesization (AND terms wrapped in OR context).

Also provides `countGates()` for gate type breakdown statistics.

---

## UI Components

### App.tsx

Root component. Manages:
- Panel visibility state (bottom panel, right panel)
- Resizable panel sizes via `useResizable` hooks
- Auto-compile timer (400ms debounce)
- Export menu
- Theme toggle
- Example circuit selector

Layout: iOS-inspired bento grid with rounded panels (`rounded-2xl`), inset glow borders, and uniform 4px gaps.

### CodeEditor.tsx

Syntax-highlighted code editor using textarea + pre overlay technique:
- Transparent textarea on top (captures input, shows caret)
- Pre element behind with colored HTML (renders syntax highlighting)
- Synchronized scrolling between both elements

**Syntax colors (dark theme):**
- Keywords (INPUT, OUTPUT, MODULE): `#ff7b72` (coral)
- Gates (AND, OR, NOT, etc.): `#79c0ff` (blue)
- Comments: `#8b949e` (gray, italic)
- Module names (PascalCase): `#d2a8ff` (purple)
- Variables/signals: `#ffa657` (amber)
- Operators: `#c9d1d9` (light gray)
- Numbers: `#f0883e` (orange)

### CircuitRenderer.tsx

SVG-based circuit renderer with:
- Pan (mouse drag on canvas)
- Zoom (mouse wheel, clamped 0.2x-4x)
- Node dragging (updates wire endpoints in real time)
- Input toggling (click input nodes)
- Double-click rename (inline input overlay)
- Right-click context menu (rename, toggle, resize)
- Animated signal flow (circle moving along active wires)
- Dot grid background pattern

Sub-components: `InputNode`, `OutputNode`, `GateNodeSVG`, `WireComp`, `Grid`

### DiagnosticsPanel.tsx

Displays compiler/simulator diagnostics with severity icons (error, warning, info) and line:col references.

### TruthTablePanel.tsx

Renders truth table as an HTML table with:
- Sticky header row
- Color-coded values (blue for inputs, green for active outputs)
- CSV export button

### DocsPanel.tsx

Collapsible documentation sections covering syntax, gates, examples, and tips. Uses accordion pattern with chevron indicators.

### DimensionsPanel.tsx

Three-tab interface for configuring layout dimensions:
- Global: layer gap, node gap, padding
- By Type: gate/input/output default sizes
- Per Node: individual node size overrides with dropdown selector

### VisionPanel.tsx

Image-to-HDL prototype:
- Drag/drop or paste image upload
- Basic heuristic analysis (rejects colorful images)
- Mock HDL extraction (demonstrates the UI flow)

### BoolExprConverter.tsx

Boolean expression to HDL converter:
- Parses expressions with `+` (OR), `·`/`*` (AND), `!`/`¬` (NOT), `^` (XOR)
- Supports `output = expression` format
- Generates HDL with intermediate signals

### ResizeHandle.tsx

Invisible resize handle (0px visible width/height) with a 10px hit area. The visual gap between panels serves as the resize indicator.

### gates/GatePaths.ts

SVG path definitions for all gate types in a 60x40 viewBox:
- AND: D-shape (rectangle + semicircle)
- OR: Curved body (quadratic bezier)
- NOT: Triangle + negation bubble
- BUF: Triangle (no bubble)
- NAND/NOR: Same as AND/OR + bubble
- XOR/XNOR: OR shape with extra input arc
- DFF/TFF/JKFF: Rectangle

---

## Hooks

### useCircuit (src/hooks/useCircuit.ts)

Main orchestration hook. Returns:

```typescript
{
  graph: CircuitGraph | null;
  layout: CircuitLayout | null;
  simulation: SimulationState | null;
  diagnostics: Diagnostic[];
  truthTable: TruthTable | null;
  inputValues: Map<string, LogicValue>;
  compile: (code: string, dimConfig?: DimensionConfig) => void;
  reLayout: (dimConfig: DimensionConfig) => void;
  toggleInput: (nodeId: string) => void;
  nodeCount: number;
  wireCount: number;
}
```

**compile()** runs the full pipeline: parse -> build graph -> layout -> simulate -> truth table. Stops early if parse errors are found.

**toggleInput()** flips a single input value and re-runs simulation without recompiling.

**reLayout()** recomputes layout with new dimension config without recompiling.

### useResizable (src/hooks/useResizable.ts)

Panel resize hook. Two variants:
- `useResizable`: normal direction (drag right = bigger)
- `useResizableInverted`: inverted direction (drag left = bigger, for right panels and bottom panels)

Returns `{ size, setSize, handleMouseDown }`. Uses document-level mousemove/mouseup listeners for smooth dragging.

---

## Theming

File: `src/context/ThemeContext.tsx`

Two themes with 35+ semantic color tokens each:

### Dark Theme (Navy)

Based on GitHub Dark / VS Code Dark+ aesthetic:
- Background: `#0d1117` (deep navy)
- Surfaces: `#161b22`
- Borders: `#30363d`
- Text: `#e6edf3` primary, `#8b949e` secondary
- Accent: `#58a6ff` (blue)
- Success: `#56d364`, Error: `#f85149`, Warning: `#e3b341`

### Light Theme

Clean professional white:
- Background: `#e8eaef` (neutral gray)
- Surfaces: `#ffffff`
- Borders: `#d0d4dc`
- Text: `#1a1d26` primary, `#4a5060` secondary
- Accent: `#2563eb` (blue)
- Success: `#16a34a`, Error: `#dc2626`, Warning: `#d97706`

### iOS-Style Panel Effects

All panels use a combined box-shadow for the characteristic iOS glow:
```css
inset 0 1px 0 0 rgba(255,255,255,0.04)  /* top edge highlight */
0 0 0 0.5px rgba(255,255,255,0.03)       /* subtle outer ring */
0 2px 8px rgba(0,0,0,0.3)                /* elevation shadow */
```

Theme is persisted to `localStorage` under key `logicsvg-theme` and applied via `data-theme` attribute on `<html>`.

---

## Export System

File: `src/utils/exportUtils.ts`

### SVG Export

1. Clone the SVG DOM element
2. Set proper xmlns attributes
3. Calculate bounding box with 20px padding
4. Serialize to string via XMLSerializer
5. Download as `.svg` blob

### PNG Export

1. Clone SVG and set viewBox
2. Render at 3x scale for high resolution
3. Create Image from SVG blob URL
4. Draw onto Canvas with dark background fill
5. Export canvas as PNG blob

### PDF Export

1. Clone SVG with viewBox
2. Wrap in minimal HTML with print styles
3. Open in new window
4. Trigger `window.print()` for system print dialog

---

## Configuration and Dimensions

### DimensionConfig

Controls all layout spacing and node sizes. Exposed via the Dimensions panel UI.

Default values:
| Parameter | Default | Range |
|-----------|---------|-------|
| layerGap | 140px | 80-300 |
| nodeGap | 60px | 30-150 |
| padding | 50px | 20-120 |
| gateWidth | 72px | 50-180 |
| gateHeight | 44px | 24-90 |
| inputWidth | 68px | 50-180 |
| inputHeight | 36px | 24-90 |
| outputWidth | 68px | 50-180 |
| outputHeight | 36px | 24-90 |

Node width auto-expands based on label length: `max(configured, labelLength * charWidth + padding)`.

Per-node overrides are stored in a `Map<string, { width, height }>` keyed by node ID.

### Auto-Compile

Enabled by default. Uses a 400ms debounce timer that resets on every keystroke. Can be toggled off for manual compilation.

### Truth Table Limits

- Generated only when input count is between 1 and 10
- Capped at 256 rows (2^8) for performance
- Exported as CSV with binary values

---

## File Reference

```
src/
  App.tsx                          Main application layout and state
  main.tsx                         React entry point
  index.css                        Global styles, scrollbars, range inputs

  compiler/
    lexer.ts                       Tokenizer (source -> Token[])
    parser.ts                      Recursive descent parser (Token[] -> AST)
    graphBuilder.ts                AST -> CircuitGraph (flattens modules)

  simulator/
    simulator.ts                   Topological sort + gate evaluation
    booleanExpr.ts                 Symbolic expression extraction

  layout/
    layoutEngine.ts                Sugiyama layered layout algorithm

  components/
    CodeEditor.tsx                 Syntax-highlighted textarea editor
    CircuitRenderer.tsx            Interactive SVG circuit renderer
    DiagnosticsPanel.tsx           Error/warning/info display
    TruthTablePanel.tsx            Truth table with CSV export
    DocsPanel.tsx                  HDL documentation accordion
    DimensionsPanel.tsx            Layout dimension controls
    VisionPanel.tsx                Image-to-HDL upload UI
    BoolExprConverter.tsx          Boolean expression parser/converter
    ResizeHandle.tsx               Invisible panel resize handle
    gates/
      GatePaths.ts                 SVG path definitions for all gates

  hooks/
    useCircuit.ts                  Pipeline orchestration hook
    useResizable.ts                Panel resize drag hook

  context/
    ThemeContext.tsx                Dark/light theme provider + palettes

  types/
    index.ts                       All TypeScript interfaces and types

  utils/
    cn.ts                          clsx + tailwind-merge utility
    exportUtils.ts                 SVG/PNG/PDF export functions
```

---

## Build and Dependencies

### Dependencies (runtime)
- react 19.2.6
- react-dom 19.2.6
- lucide-react (icon library)
- clsx + tailwind-merge (className utility)

### Dev Dependencies
- vite 7.3.2
- @vitejs/plugin-react
- tailwindcss 4.1.17 (via @tailwindcss/vite plugin)
- typescript 5.9.3
- vite-plugin-singlefile (inlines all assets into one HTML file)

### Build Output

Single `dist/index.html` file containing all JavaScript, CSS, and assets inlined. No external requests needed at runtime.
