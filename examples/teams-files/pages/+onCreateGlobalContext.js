// Vike's once-per-server hook — where this demo opts into a universal-orm adapter. With no real
// database wired, it registers the in-process MEMORY adapter so the auth store + teams store +
// uploads persist for the life of the dev server, and seeds one organization with two members.
// A real app swaps this one line for vike-drizzle + registerDrizzle(...) pointed at a migrated
// database; nothing else changes.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// A valid storage key (the package only serves keys shaped like the uuids it issues, see
// isStorageKey), so the seeded file is downloadable in the dev run.
const SEED_KEY = '11111111-1111-4111-8111-111111111111'

export default async function onCreateGlobalContext() {
  // Bind vike-storage's RUNTIME owner resolution to the ORGANIZATION (#250), the runtime half of
  // the build-time `storageOwner` in +config.js:
  //   - VIKE_STORAGE_OWNER_COLUMN: the FK column the upload row is written/queried under. Must
  //     match `storageOwner.column` so the build-time schema and the runtime write agree.
  //   - VIKE_STORAGE_OWNER_FROM: which field on the signed-in user row holds the owner id. Here
  //     it is teams' `current_organization_id`, so an upload is scoped to the user's active org
  //     rather than to the user. Default ('id') = the user owns it, byte-for-byte unchanged.
  // Set here (the once-per-server hook, before any request) rather than a .env so the demo is
  // self-contained; a real app would set these in its environment. `??=` leaves an explicit
  // override untouched.
  process.env.VIKE_STORAGE_OWNER_COLUMN ??= 'organization_id'
  process.env.VIKE_STORAGE_OWNER_FROM ??= 'current_organization_id'

  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)

  // One organization, owned by Ada. teams' `organizations` table (#292 owns the schema).
  adapter.insert('organizations', {
    id: 'org-acme',
    name: 'Acme Corp',
    slug: 'acme',
    owner_id: 'u-ada',
    created_at: daysAgo(30),
    updated_at: daysAgo(2),
  })

  // Two members of the same org, both on the DEFAULT user guard's `users` table. Each carries
  // teams' `current_organization_id` = the same org, so storage resolves either member's upload
  // to `org-acme`. Because the magic-link store looks a subject up by email before creating one,
  // signing in as these addresses REUSES the seeded rows.
  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, current_organization_id: 'org-acme', created_at: daysAgo(30), updated_at: daysAgo(2) })
  adapter.insert('users', { id: 'u-grace', email: 'grace@example.com', name: 'Grace Hopper', active: true, current_organization_id: 'org-acme', created_at: daysAgo(20), updated_at: daysAgo(1) })

  // Memberships join each user to the org (teams' `memberships` table). Ada is the admin (org
  // owner), Grace a member; both can see and delete the org's files.
  adapter.insert('memberships', { id: 'm-ada', organization_id: 'org-acme', user_id: 'u-ada', role: 'admin', created_at: daysAgo(30), updated_at: daysAgo(30) })
  adapter.insert('memberships', { id: 'm-grace', organization_id: 'org-acme', user_id: 'u-grace', role: 'member', created_at: daysAgo(20), updated_at: daysAgo(20) })

  // One file ALREADY owned by the org (uploaded by Ada). The owner column is `organization_id`,
  // not `user_id` — this is exactly the row vike-storage's POST /uploads writes once
  // VIKE_STORAGE_OWNER_FROM resolves Ada's `current_organization_id`. It is inserted directly
  // here (rather than calling storeUpload) only to keep this server hook out of the client
  // bundle: vike-storage's server module pulls in node:crypto, which Vike externalizes for the
  // browser. The org -> upload scoping itself is covered end-to-end by the package tests; the
  // home page reads + deletes this row, and a live upload by either member appends another.
  adapter.insert('uploads', {
    id: 'up-handbook',
    organization_id: 'org-acme',
    storage_key: SEED_KEY,
    filename: 'acme-handbook.txt',
    mime: 'text/plain',
    size: 24,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  })

  // Prime the bytes for the seeded file in vike-storage's built-in in-memory blob store (cached
  // on globalThis under the same Symbol the default provider uses), so its capability URL serves
  // content in the dev run. A live upload primes its own bytes through the provider.
  const store = (globalThis[Symbol.for('vike-storage.memory-store')] ??= new Map())
  store.set(SEED_KEY, {
    bytes: new TextEncoder().encode('Acme org shared file.\n'),
    meta: { filename: 'acme-handbook.txt', mime: 'text/plain', size: 24 },
  })
}
