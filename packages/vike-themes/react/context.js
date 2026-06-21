// Pure-JS context + hook (no JSX), so the config entry (index.js) can re-export
// useTheme without forcing Node to load a .jsx file when Vike resolves the config.
// The JSX (ThemeProvider, the Wrapper, the picker) stays in .jsx files that only
// Vite loads, via the pointer-imports in the config.
import { createContext, useContext } from 'react'

export const ThemeCtx = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('[vike-themes/react] useTheme must be used inside the theme Wrapper')
  return ctx
}
