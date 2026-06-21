import vike from 'vike/plugin'
import vikeSchema from '@vike-data/vike-schema/plugin'

export default {
  // vikeSchema reads Vike's resolved config graph (the merged `schemas` from
  // every installed extension) and writes the per-ORM artifacts on build + dev
  // start. It replaces the old app-owned generate.mjs stand-in.
  plugins: [vike(), vikeSchema()],
  server: { port: 4000, strictPort: true },
}
