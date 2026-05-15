// ============================================================
// LogicSVG Pro — Circuit Compilation & Simulation Hook
// ============================================================
import { useState, useCallback, useRef } from 'react';
import type {
  CircuitGraph, CircuitLayout, SimulationState,
  Diagnostic, TruthTable, LogicValue
} from '@/types';
import { parseHDL } from '@/compiler/parser';
import { buildGraph } from '@/compiler/graphBuilder';
import { computeLayout } from '@/layout/layoutEngine';
import { simulate, generateTruthTable } from '@/simulator/simulator';
import type { DimensionConfig } from '@/components/DimensionsPanel';
import { DEFAULT_DIMENSIONS } from '@/components/DimensionsPanel';

interface UseCircuitReturn {
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

export function useCircuit(): UseCircuitReturn {
  const [graph, setGraph] = useState<CircuitGraph | null>(null);
  const [layout, setLayout] = useState<CircuitLayout | null>(null);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [truthTable, setTruthTable] = useState<TruthTable | null>(null);
  const [inputValues, setInputValues] = useState<Map<string, LogicValue>>(new Map());
  const graphRef = useRef<CircuitGraph | null>(null);
  const codeRef = useRef<string>('');

  const runSimulation = useCallback((g: CircuitGraph, inputs: Map<string, LogicValue>) => {
    const { state, diagnostics: simDiags } = simulate(g, inputs);
    setSimulation(state);
    return simDiags;
  }, []);

  const compile = useCallback((code: string, dimConfig?: DimensionConfig) => {
    codeRef.current = code;
    const allDiags: Diagnostic[] = [];

    // Parse
    const { circuit, diagnostics: parseDiags } = parseHDL(code);
    allDiags.push(...parseDiags);

    if (parseDiags.some(d => d.severity === 'error')) {
      setDiagnostics(allDiags);
      return;
    }

    // Build graph
    const { graph: g, diagnostics: buildDiags } = buildGraph(circuit);
    allDiags.push(...buildDiags);

    if (buildDiags.some(d => d.severity === 'error')) {
      setDiagnostics(allDiags);
      return;
    }

    setGraph(g);
    graphRef.current = g;

    // Layout with dimensions config
    const config = dimConfig ?? DEFAULT_DIMENSIONS;
    const l = computeLayout(g, config);
    setLayout(l);

    // Initialize inputs
    const newInputValues = new Map<string, LogicValue>();
    for (const inputId of g.inputIds) {
      newInputValues.set(inputId, false);
    }
    setInputValues(newInputValues);

    // Simulate
    const simDiags = runSimulation(g, newInputValues);
    allDiags.push(...simDiags);

    // Truth table
    if (g.inputIds.length <= 10 && g.inputIds.length > 0) {
      try {
        const tt = generateTruthTable(g);
        setTruthTable(tt);
      } catch {
        allDiags.push({
          severity: 'warning',
          message: 'Could not generate truth table',
          line: 0,
          col: 0,
        });
      }
    } else {
      setTruthTable(null);
    }

    allDiags.push({
      severity: 'info',
      message: `Compiled: ${g.nodes.size} nodes, ${g.inputIds.length} inputs, ${g.outputIds.length} outputs`,
      line: 0,
      col: 0,
    });

    setDiagnostics(allDiags);
  }, [runSimulation]);

  const reLayout = useCallback((dimConfig: DimensionConfig) => {
    const g = graphRef.current;
    if (!g) return;

    const l = computeLayout(g, dimConfig);
    setLayout(l);
  }, []);

  const toggleInput = useCallback((nodeId: string) => {
    setInputValues(prev => {
      const next = new Map(prev);
      next.set(nodeId, !prev.get(nodeId));

      if (graphRef.current) {
        const { state } = simulate(graphRef.current, next);
        setSimulation(state);
      }

      return next;
    });
  }, []);

  return {
    graph,
    layout,
    simulation,
    diagnostics,
    truthTable,
    inputValues,
    compile,
    reLayout,
    toggleInput,
    nodeCount: layout?.nodes.length ?? 0,
    wireCount: layout?.wires.length ?? 0,
  };
}
