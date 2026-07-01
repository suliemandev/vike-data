import { fileURLToPath } from 'node:url'
import vike from 'vike/plugin'
import tailwindcss from '@tailwindcss/vite'

// The `@/…` path alias Animate UI components use (shadcn convention) -> this app's root.
const root = fileURLToPath(new URL('.', import.meta.url))

export default {
  plugins: [vike(), tailwindcss()],
  resolve: {
    alias: { '@': root },
    // One React instance shared across app + motion (avoids cross-copy SSR errors).
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: { port: 4400, strictPort: true },
}
