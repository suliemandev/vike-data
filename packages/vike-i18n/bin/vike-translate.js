#!/usr/bin/env node
// Thin executable wrapper for `vike translate` (#102). All logic lives in cli.js so it
// stays unit-testable; this just runs it and maps the result to a process exit code
// (non-zero on a failed `--check`, so CI gates on a stale translation.json).
import { main } from '../cli.js'

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write((err && err.message ? err.message : String(err)) + '\n')
    process.exit(1)
  })
