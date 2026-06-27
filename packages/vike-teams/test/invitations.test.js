// The invitation flow (#292) end to end on the in-process memory adapter: invite an email,
// accept it as the matching subject to create a membership, and the guardrails around that
// (single-use, expiry, email match, revoke, list). vike-teams ships no DB of its own, so the
// memory adapter is the runtime the package tests + demos run on.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, getAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import {
  inviteToMembership,
  acceptInvitation,
  revokeInvitation,
  listInvitations,
} from '../invitations.js'

const ORG = 'org-1'
// The subject the app resolves and hands to acceptInvitation (the default user or a named
// guard's user — vike-teams only reads { id, email }).
const alice = { id: 'u-alice', email: 'alice@example.com' }

beforeEach(() => {
  clearAdapter()
  setAdapter(createMemoryAdapter())
})

const memberships = () => getAdapter().find('memberships', {})

test('invite -> accept creates a membership with the invited role', async () => {
  const invite = await inviteToMembership({ organizationId: ORG, email: 'Alice@Example.com', role: 'admin', invitedBy: 'u-boss' })
  assert.ok(invite.token, 'returns an opaque token for the app to deliver')
  assert.equal(invite.email, 'alice@example.com', 'email is normalized to lower-case')
  assert.equal(invite.role, 'admin')

  const res = await acceptInvitation(invite.token, alice)
  assert.equal(res.ok, true)
  assert.equal(res.alreadyMember, false)
  assert.equal(res.membership.organization_id, ORG)
  assert.equal(res.membership.user_id, alice.id)
  assert.equal(res.membership.role, 'admin', 'membership carries the invited role')
  assert.equal((await memberships()).length, 1)
})

test('single-use: accepting the same token twice does not create a second membership', async () => {
  const { token } = await inviteToMembership({ organizationId: ORG, email: alice.email })
  const first = await acceptInvitation(token, alice)
  assert.equal(first.ok, true)
  const second = await acceptInvitation(token, alice)
  assert.equal(second.ok, false)
  assert.equal(second.error, 'used')
  assert.equal((await memberships()).length, 1, 'still exactly one membership')
})

test('idempotent: accepting when already a member is a no-op success, no duplicate', async () => {
  // Pre-existing membership for alice in ORG.
  getAdapter().insert('memberships', { id: 'm-pre', organization_id: ORG, user_id: alice.id, role: 'member', created_at: 't', updated_at: 't' })
  const { token } = await inviteToMembership({ organizationId: ORG, email: alice.email, role: 'admin' })
  const res = await acceptInvitation(token, alice)
  assert.equal(res.ok, true)
  assert.equal(res.alreadyMember, true)
  assert.equal((await memberships()).length, 1, 'no duplicate membership row')
})

test('expired invitations are rejected', async () => {
  const { token } = await inviteToMembership({ organizationId: ORG, email: alice.email, ttlMs: -1 })
  const res = await acceptInvitation(token, alice)
  assert.equal(res.ok, false)
  assert.equal(res.error, 'expired')
  assert.equal((await memberships()).length, 0)
})

test('the accepting user email must match the invited email', async () => {
  const { token } = await inviteToMembership({ organizationId: ORG, email: alice.email })
  const bob = { id: 'u-bob', email: 'bob@example.com' }
  const res = await acceptInvitation(token, bob)
  assert.equal(res.ok, false)
  assert.equal(res.error, 'email-mismatch')
  assert.equal((await memberships()).length, 0)
})

test('a revoked invitation cannot be accepted', async () => {
  const invite = await inviteToMembership({ organizationId: ORG, email: alice.email })
  const revoke = await revokeInvitation(invite.id)
  assert.equal(revoke.ok, true)
  assert.equal(revoke.revoked, true)
  const res = await acceptInvitation(invite.token, alice)
  assert.equal(res.ok, false)
  assert.equal(res.error, 'revoked')
  // revoking again is a no-op (idempotent)
  assert.equal((await revokeInvitation(invite.id)).revoked, false)
})

test('an unknown token is invalid', async () => {
  const res = await acceptInvitation('not-a-real-token', alice)
  assert.equal(res.ok, false)
  assert.equal(res.error, 'invalid-token')
})

test('listInvitations returns the org pending invites, newest first; status filter works', async () => {
  const a = await inviteToMembership({ organizationId: ORG, email: 'a@example.com' })
  await inviteToMembership({ organizationId: ORG, email: 'b@example.com' })
  await inviteToMembership({ organizationId: 'other-org', email: 'c@example.com' })

  const pending = await listInvitations(ORG)
  assert.equal(pending.length, 2, 'only this org, only pending')
  assert.ok(pending.every((i) => i.organization_id === ORG && i.status === 'pending'))

  // accept one -> it leaves the pending list
  await acceptInvitation(a.token, { id: 'u-a', email: 'a@example.com' })
  assert.equal((await listInvitations(ORG)).length, 1)
  assert.equal((await listInvitations(ORG, { status: 'accepted' })).length, 1)
  assert.equal((await listInvitations(ORG, { status: null })).length, 2, 'null status = every status')
})

test('throws a clear error when no adapter is registered', async () => {
  clearAdapter()
  await assert.rejects(
    () => inviteToMembership({ organizationId: ORG, email: alice.email }),
    /no universal-orm adapter registered/,
  )
})
