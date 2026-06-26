import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { clearQueue } from 'vike-queue'

// The bare-id hydration reads vike-auth's subject table, whose name is configurable
// (VIKE_AUTH_SUBJECT_TABLE). index.js resolves that name ONCE at import, so the rename has to
// be in env BEFORE index.js evaluates. ESM hoists static imports above the module body, so
// a static `import '../index.js'` would evaluate first and miss this; hence the dynamic
// import after setting env. node --test isolates each file in its own process, so this
// override never leaks into the other vike-notifications test files.
process.env.VIKE_AUTH_SUBJECT_TABLE = 'members'
const { notify, registerChannel, clearChannels } = await import('../index.js')

test('notify hydrates a bare user id from the renamed subject table', async () => {
  clearChannels()
  clearQueue()
  clearAdapter()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  // The user lives in the renamed table, not `users`. Before the fix, hydration read the
  // hardcoded `users` table, found nothing, and threw "no user found".
  await adapter.insert('members', { id: 'u-1', email: 'a@b.c' })

  const sent = []
  registerChannel({ name: 'mail', send: async (notifiable) => { sent.push(notifiable) } })

  await notify('u-1', { via: () => ['mail'], toMail: (u) => ({ to: u.email }) })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].email, 'a@b.c') // hydrated from `members`, proving the rename is honored
})
