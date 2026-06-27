// drizzle-kit config: derive SQL migrations from the GENERATED Drizzle schema.
//
// The schema file is not hand-written -- vike-schema emits it from the merged extension
// schemas (see vite.config.js). drizzle-kit reads it and writes committed SQL migrations to
// drizzle/migrations, the desired-state -> migration step the framework deliberately leaves to
// Drizzle's own tooling. dialect is `postgresql` because pglite IS Postgres (and vike-schema's
// codegen emits pg-core); `generate` diffs the schema against its snapshot and needs no live DB.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './drizzle/schema.generated.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
})
