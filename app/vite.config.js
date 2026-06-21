import vike from 'vike/plugin'
import { vikeSchemaGenerate } from '@vike-data/vike-schema/plugin'

export default {
  // vikeSchemaGenerate reads Vike's resolved config graph (the merged `schemas`
  // from every installed extension) and writes the per-ORM artifacts on build +
  // dev start. It replaces the old app-owned generate.mjs stand-in.
  plugins: [vike(), vikeSchemaGenerate()],
  server: { port: 4000, strictPort: true },
}
