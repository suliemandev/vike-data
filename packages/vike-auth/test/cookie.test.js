// Dependency-free cookie reader/writer. Defaults are security-relevant
// (HttpOnly + SameSite=Lax), so they are pinned explicitly here.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCookies, serializeCookie } from '../cookie.js'

// --------------------------------------------------------------- parsing -----

test('parseCookies returns {} for missing/empty headers', () => {
  assert.deepEqual(parseCookies(undefined), {})
  assert.deepEqual(parseCookies(''), {})
})

test('parseCookies reads a single pair', () => {
  assert.deepEqual(parseCookies('vike_auth_session=abc'), { vike_auth_session: 'abc' })
})

test('parseCookies reads multiple pairs and trims whitespace', () => {
  assert.deepEqual(parseCookies('a=1; b=2;c=3'), { a: '1', b: '2', c: '3' })
})

test('parseCookies URL-decodes values', () => {
  assert.deepEqual(parseCookies('redirect=%2Fdashboard%3Fx%3D1'), { redirect: '/dashboard?x=1' })
})

test('parseCookies skips segments with no = and empty keys', () => {
  assert.deepEqual(parseCookies('garbage; =novalue; ok=1'), { ok: '1' })
})

test('parseCookies keeps = inside the value', () => {
  assert.deepEqual(parseCookies('token=a=b=c'), { token: 'a=b=c' })
})

// ------------------------------------------------------------ serializing ----

test('serializeCookie applies secure-by-default flags', () => {
  const c = serializeCookie('vike_auth_session', 'tok')
  assert.equal(c, 'vike_auth_session=tok; Path=/; HttpOnly; SameSite=Lax')
})

test('serializeCookie URL-encodes the value', () => {
  assert.match(serializeCookie('redirect', '/a?b=1'), /^redirect=%2Fa%3Fb%3D1;/)
})

test('serializeCookie includes Max-Age (floored) when given', () => {
  assert.match(serializeCookie('s', 'v', { maxAge: 60.9 }), /; Max-Age=60(;|$)/)
})

test('serializeCookie with maxAge 0 clears the cookie', () => {
  assert.match(serializeCookie('s', '', { maxAge: 0 }), /; Max-Age=0(;|$)/)
})

test('httpOnly:false opts out of HttpOnly; otherwise it is present', () => {
  assert.ok(!serializeCookie('s', 'v', { httpOnly: false }).includes('HttpOnly'))
  assert.ok(serializeCookie('s', 'v', {}).includes('HttpOnly'))
})

test('secure is opt-in (off by default so http://localhost works)', () => {
  assert.ok(!serializeCookie('s', 'v').includes('Secure'))
  assert.ok(serializeCookie('s', 'v', { secure: true }).includes('; Secure'))
})

test('sameSite and path are overridable', () => {
  const c = serializeCookie('s', 'v', { sameSite: 'Strict', path: '/auth' })
  assert.match(c, /; Path=\/auth;/)
  assert.match(c, /; SameSite=Strict/)
})
