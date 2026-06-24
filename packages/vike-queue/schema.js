// The `jobs` table the DATABASE driver (database.js) persists work into. vike-queue
// owns it the same way vike-auth owns `users` (the Stem pattern): declared once
// through the neutral schema DSL, derived to whatever ORM the app runs. Contributed
// to vike-schema's cumulative `schemas` point from +config.js, so installing
// vike-queue adds the table with no app wiring.
//
// Only the database driver reads it; the inline driver (the dev default) never
// touches a table, so an app that never registers the database driver still gets the
// schema but simply leaves it empty.
import { defineSchema } from '@vike-data/vike-schema/schema'

export const jobsSchema = defineSchema('jobs', (t) => {
  t.uuid('id').primary()
  // The registered job name (registerJob) the driver looks the handler up by.
  t.string('name')
  // The dispatch payload, stored as a JSON string (driver-neutral; no JSON column
  // type assumed across ORMs).
  t.string('payload')
  // pending -> done | failed. A pending row with run_at <= now is claimable.
  t.string('status').default('pending')
  t.integer('attempts').default(0)
  t.integer('max_attempts').default(1)
  // When the job becomes eligible to run (now for immediate, future for backoff retry).
  t.timestamp('run_at').nullable()
  t.timestamp('failed_at').nullable()
  t.string('last_error').nullable()
  t.timestamps()
})

export default jobsSchema
