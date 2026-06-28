// vike-themes / vike-theme-emerald ship plain ESM with no bundled .d.ts. This
// example is strict TSX, so declare the small surface it uses. (The other
// examples avoid this by importing these packages from plain .js files.)

declare module 'vike-themes' {
  export interface Theme {
    name: string
    fonts: Record<string, string>
    radius?: string
    spacing: Record<string, string>
    light: Record<string, string>
    dark: Record<string, string>
  }
  export function defineTheme(tokens: {
    name?: string
    fonts?: Record<string, string>
    radius?: string
    spacing?: Record<string, string>
    light?: Record<string, string>
    dark?: Record<string, string>
    colors?: Record<string, string>
  }): Theme
  export function themeToAppearanceCss(theme: Theme, appearance?: string, selector?: string): string
}

declare module 'vike-theme-emerald' {
  import type { Theme } from 'vike-themes'
  export const emerald: Theme
  const _default: Theme
  export default _default
}

declare module '*.svg' {
  const url: string
  export default url
}
