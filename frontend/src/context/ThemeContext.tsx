import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ThemeMode = 'dark' | 'light';

export interface ThemePalette {
  bgApp: string;
  bgSurface: string;
  bgPanel: string;
  bgEditor: string;
  bgCanvas: string;
  bgElevated: string;
  bgHover: string;
  bgInset: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  wireOff: string;
  wireOn: string;
  wireGlow: string;
  nodeBody: string;
  nodeBodyOn: string;
  nodeStroke: string;
  nodeStrokeOn: string;
  inputAccent: string;
  outputAccent: string;
  glassBlur: string;
}

// ────────────────────────────────────────────
// Dark theme — Deep navy, VS Code Islands Dark style
// ────────────────────────────────────────────
const DARK: ThemePalette = {
  bgApp:      '#0d1117', // Deep navy (gap between panels)
  bgSurface:  '#161b22', // Panel surfaces
  bgPanel:    '#1c2128', // Panel header backgrounds
  bgEditor:   '#161b22', // Editor background
  bgCanvas:   '#1c2128', // Canvas — slightly lighter for node contrast
  bgElevated: '#2d333b', // Elevated elements (buttons, dropdowns)
  bgHover:    '#373e47', // Hover state
  bgInset:    '#0d1117', // Inset/recessed areas

  border:       '#30363d', // Primary borders
  borderSubtle: '#21262d', // Subtle separators

  textPrimary:   '#e6edf3', // High contrast primary text
  textSecondary: '#8b949e', // Secondary text
  textMuted:     '#6e7681', // Muted labels
  textFaint:     '#484f58', // Very subtle text

  accent:     '#58a6ff', // Blue accent
  accentSoft: '#58a6ff18',
  accentText: '#79c0ff', // Lighter accent for text

  success:     '#56d364', // Green
  successSoft: '#56d36412',
  error:       '#f85149', // Red
  errorSoft:   '#f8514912',
  warning:     '#e3b341', // Yellow
  warningSoft: '#e3b34112',
  info:        '#79c0ff', // Sky blue
  infoSoft:    '#79c0ff12',

  wireOff:  '#484f58',   // Visible off-wires
  wireOn:   '#56d364',
  wireGlow: '#56d36430',

  nodeBody:     '#21262d', // Lighter than canvas for contrast
  nodeBodyOn:   '#1a3024',
  nodeStroke:   '#6e7681', // Visible strokes
  nodeStrokeOn: '#56d364',
  inputAccent:  '#58a6ff',
  outputAccent: '#f0883e',
  
  glassBlur: '12px',
};

// ────────────────────────────────────────────
// Light theme — Clean, professional, high circuit contrast
// ────────────────────────────────────────────
const LIGHT: ThemePalette = {
  bgApp:      '#e8eaef', // Neutral gray (between panels)
  bgSurface:  '#ffffff', // Pure white surfaces
  bgPanel:    '#f5f6f8', // Panel header backgrounds
  bgEditor:   '#fafbfc', // Editor background
  bgCanvas:   '#f8f9fb', // Canvas — very light for max node contrast
  bgElevated: '#ffffff', // Elevated white
  bgHover:    '#ebedf2', // Hover state
  bgInset:    '#f0f1f4', // Inset areas

  border:       '#d0d4dc', // Clear borders
  borderSubtle: '#e2e5eb', // Subtle separators

  textPrimary:   '#1a1d26', // Near-black for max readability
  textSecondary: '#4a5060', // Dark gray secondary
  textMuted:     '#7a8090', // Medium gray
  textFaint:     '#a8b0c0', // Light gray

  accent:     '#2563eb', // Vibrant blue
  accentSoft: '#2563eb10',
  accentText: '#1d4ed8', // Darker blue for text

  success:     '#16a34a', // Green
  successSoft: '#16a34a10',
  error:       '#dc2626', // Red
  errorSoft:   '#dc262610',
  warning:     '#d97706', // Amber
  warningSoft: '#d9770610',
  info:        '#0891b2', // Cyan
  infoSoft:    '#0891b210',

  wireOff:  '#b0b8c8',   // Visible off-wires
  wireOn:   '#16a34a',
  wireGlow: '#16a34a30',

  nodeBody:     '#ffffff', // White nodes on light canvas
  nodeBodyOn:   '#ecfdf5',
  nodeStroke:   '#64748b', // Strong strokes for visibility
  nodeStrokeOn: '#16a34a',
  inputAccent:  '#2563eb',
  outputAccent: '#ea580c',

  glassBlur: '12px',
};

interface ThemeContextType {
  mode: ThemeMode;
  palette: ThemePalette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  palette: DARK,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('logicsvg-theme') as ThemeMode | null;
    return saved ?? 'dark';
  });

  useEffect(() => {
    localStorage.setItem('logicsvg-theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const palette = mode === 'dark' ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ mode, palette, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
