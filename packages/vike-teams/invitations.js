// vike-teams/invitations.js — the invitation flow (#292): invite an email into an
// organization, accept it to create a membership. This is the FIRST runtime tier of
// vike-teams (the package was pure schema); it reads and writes through the neutral
// universal-orm adapter, exactly the way vike-storage and vike-notifications do — no
// extension ever imports an ORM.
//
// Delivery is the APP's job (out of scope per #292): inviteToMembership() returns the opaque
// token (and the invite row); the app builds and sends the accept link however it likes (e.g.
// through vike-mail). The primitive here is token issuance + single-use, expiring acceptance +
// revoke + list — not the email template or transport.
//
// Server-only: it holds the adapter and mints tokens, so it must never reach the client bundle.
// Subject tables follow the same rename knobs as the schema (resolveSubject for auth's `users`,
// resolveTeamSubject for the team tables), read per call so a renamed app Just Works.
import { getAdapter } from '@universal-orm/core'
import { resolveTeamSubject } from './subject.js'

// Invites live longer than magic links — a teammate may not check mail for days.
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Runtime-agnostic id/token/time helpers on Web Crypto (Node 19+, Deno, Bun, Workers) — the
// same basis vike-auth's tokens.js uses; replicated here because auth's helper is internal.
const webcrypto = globalThis.crypto
const newId = () => webcrypto.randomUUID()
function newToken() {
  const bytes = new Uint8Array(32)
  webcrypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // URL-safe base64, no padding — opaque, high-entropy, safe in an accept URL.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const isoIn = (ms, base = Date.now()) => new Date(base + ms).toISOString()
// Fails closed: an unparseable/null timestamp is treated as already expired.
const isExpired = (iso, base = Date.now()) => {
  const t = new Date(iso).getTime()
  return !Number.isFinite(t) || t <= base
}
const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

function tables() {
  const { invitations, memberships } = resolveTeamSubject()
  return { INVITATIONS: invitations, MEMBERSHIPS: memberships }
}

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error(
      '[vike-teams] no universal-orm adapter registered — call setAdapter() (or registerDrizzle / registerRudder) first',
    )
  }
  return adapter
}

/**
 * Invite an email to join an organization. Creates a single-use, expiring invitation and
 * returns it WITH the opaque token; building and delivering the accept link is the app's job.
 *
 * @param {object}  opts
 * @param {string}  opts.organizationId  the org the invitee will join.
 * @param {string}  opts.email           the invited address (normalized to lower-case).
 * @param {string}  [opts.role='member'] the role the membership is created with on accept.
 * @param {string}  [opts.invitedBy]     the inviter's subject id (recorded; SET NULL on delete).
 * @param {number}  [opts.ttlMs]         how long the invite is valid (default 7 days).
 * @returns {Promise<{ id, token, organizationId, email, role, expiresAt }>}
 */
export async function inviteToMembership({ organizationId, email, role = 'member', invitedBy = null, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!organizationId) throw new Error('[vike-teams] inviteToMembership: organizationId is required')
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error('[vike-teams] inviteToMembership: a non-empty email is required')
  const adapter = requireAdapter()
  const { INVITATIONS } = tables()
  const ts = new Date().toISOString()
  const row = {
    id: newId(),
    organization_id: organizationId,
    email: normalized,
    role: role || 'member',
    token: newToken(),
    status: 'pending',
    expires_at: isoIn(ttlMs),
    accepted_at: null,
    invited_by: invitedBy,
    created_at: ts,
    updated_at: ts,
  }
  await adapter.insert(INVITATIONS, row)
  return { id: row.id, token: row.token, organizationId, email: normalized, role: row.role, expiresAt: row.expires_at }
}

/**
 * Accept an invitation by its token, as `subject` — the signed-in user. vike-teams is
 * guard-agnostic: `subject` may be the default user or a named guard's user, and the membership
 * simply FKs into whichever `users` table the app resolved. The accepting user's email must
 * match the invited email, so a link can't be claimed by a different account.
 *
 * Single-use and expiring. On success creates the membership with the invited role; idempotent
 * if the subject is already a member of the org.
 *
 * @returns {Promise<{ ok: true, membership, alreadyMember, organizationId, role } | { ok: false, error }>}
 *   error ∈ 'invalid-token' | 'no-subject' | 'revoked' | 'used' | 'expired' | 'email-mismatch'
 */
export async function acceptInvitation(token, subject) {
  if (!token || typeof token !== 'string') return { ok: false, error: 'invalid-token' }
  if (!subject || !subject.id) return { ok: false, error: 'no-subject' }
  const adapter = requireAdapter()
  const { INVITATIONS, MEMBERSHIPS } = tables()

  const invite = (await adapter.find(INVITATIONS, { token }))[0]
  if (!invite) return { ok: false, error: 'invalid-token' }
  if (invite.status === 'revoked') return { ok: false, error: 'revoked' }
  if (invite.status === 'accepted') return { ok: false, error: 'used' }
  if (isExpired(invite.expires_at)) return { ok: false, error: 'expired' }
  if (normalizeEmail(subject.email) !== invite.email) return { ok: false, error: 'email-mismatch' }

  // Atomic single-use: the filter pins `status: 'pending'`, so only the first accept flips the
  // row; a concurrent second accept updates zero rows and bails. Same race-safe consume
  // vike-auth uses for login tokens (a read-then-write would let two requests both pass).
  const acceptedAt = new Date().toISOString()
  const [claimed] = await adapter.update(
    INVITATIONS,
    { token, status: 'pending' },
    { status: 'accepted', accepted_at: acceptedAt, updated_at: acceptedAt },
  )
  if (!claimed) return { ok: false, error: 'used' } // lost the race

  // Create the membership unless the subject already belongs to this org (idempotent).
  const existing = (await adapter.find(MEMBERSHIPS, { organization_id: invite.organization_id, user_id: subject.id }))[0]
  if (existing) {
    return { ok: true, alreadyMember: true, membership: existing, organizationId: invite.organization_id, role: existing.role }
  }
  const ts = new Date().toISOString()
  const membership = {
    id: newId(),
    organization_id: invite.organization_id,
    user_id: subject.id,
    role: invite.role || 'member',
    created_at: ts,
    updated_at: ts,
  }
  await adapter.insert(MEMBERSHIPS, membership)
  return { ok: true, alreadyMember: false, membership, organizationId: invite.organization_id, role: membership.role }
}

/**
 * Revoke a pending invitation by id. Idempotent: revoking an already-accepted or already-revoked
 * invite changes nothing. Returns `{ ok, revoked }` (`revoked` false when there was nothing to do).
 */
export async function revokeInvitation(id) {
  if (!id) throw new Error('[vike-teams] revokeInvitation: id is required')
  const adapter = requireAdapter()
  const { INVITATIONS } = tables()
  const ts = new Date().toISOString()
  const [revoked] = await adapter.update(INVITATIONS, { id, status: 'pending' }, { status: 'revoked', updated_at: ts })
  return { ok: true, revoked: Boolean(revoked) }
}

/**
 * List an organization's invitations, newest first. Pending by default; pass `{ status: null }`
 * for every status, or a specific one ('pending' | 'accepted' | 'revoked').
 */
export async function listInvitations(organizationId, { status = 'pending' } = {}) {
  if (!organizationId) throw new Error('[vike-teams] listInvitations: organizationId is required')
  const adapter = requireAdapter()
  const { INVITATIONS } = tables()
  const filter = status == null ? { organization_id: organizationId } : { organization_id: organizationId, status }
  return adapter.find(INVITATIONS, filter, { orderBy: { column: 'created_at', dir: 'desc' } })
}
