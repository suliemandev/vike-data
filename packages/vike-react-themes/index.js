// React UI wrapper for vike-themes. Re-exports the core token helpers too, so a
// component author needs a single import for both the provider and the tokens.
export { ThemeProvider, useTheme } from './ThemeProvider.jsx'
export { defineTheme, themeToCss, themeToVars, presets, light, dark } from 'vike-themes'
