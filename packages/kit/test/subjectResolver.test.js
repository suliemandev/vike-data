import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSubjectResolver } from '../index.js'

const DEFAULTS = { table: 'users', emailColumn: 'email', idColumn: 'id' }
const ENV_KEYS = { table: 'X_TABLE', emailColumn: 'X_EMAIL' } // idColumn intentionally has no env key

test('defaults: returns every field at its default with no override/env', () => {
  const resolve = createSubjectResolver(DEFAULTS, ENV_KEYS)
  assert.deepEqual(resolve({}, {}), { table: 'users', emailColumn: 'email', idColumn: 'id' })
})

test('precedence: override > env > default, per field', () => {
  const resolve = createSubjectResolver(DEFAULTS, ENV_KEYS)
  // env wins over default
  assert.equal(resolve({}, { X_TABLE: 'accounts' }).table, 'accounts')
  // override wins over env
  assert.equal(resolve({ table: 'people' }, { X_TABLE: 'accounts' }).table, 'people')
})

test('blank/whitespace override or env is treated as unset (falls through)', () => {
  const resolve = createSubjectResolver(DEFAULTS, ENV_KEYS)
  assert.equal(resolve({}, { X_TABLE: '   ' }).table, 'users')
  assert.equal(resolve({ table: '  ' }, { X_TABLE: 'accounts' }).table, 'accounts')
  assert.equal(resolve({ table: '  ' }, {}).table, 'users')
})

test('values are trimmed', () => {
  const resolve = createSubjectResolver(DEFAULTS, ENV_KEYS)
  assert.equal(resolve({ table: '  spaced  ' }, {}).table, 'spaced')
  assert.equal(resolve({}, { X_TABLE: '  enved  ' }).table, 'enved')
})

test('a field with no env key resolves from override/default only (never env)', () => {
  const resolve = createSubjectResolver(DEFAULTS, ENV_KEYS)
  // there is no env var for idColumn, so an env value cannot affect it
  assert.equal(resolve({}, { X_ID: 'pk' }).idColumn, 'id')
  // but an explicit override still applies
  assert.equal(resolve({ idColumn: 'pk' }, {}).idColumn, 'pk')
})

test('envKeys defaults to {} (all fields default/override-only)', () => {
  const resolve = createSubjectResolver(DEFAULTS)
  assert.equal(resolve({}, { X_TABLE: 'accounts' }).table, 'users') // env ignored, no keys
  assert.equal(resolve({ table: 'x' }, {}).table, 'x')
})

test('does not mutate the caller\'s defaults object', () => {
  const defs = { table: 'users' }
  const resolve = createSubjectResolver(defs)
  resolve({ table: 'other' }, {})
  assert.deepEqual(defs, { table: 'users' })
})

test('throws on a non-object defaults', () => {
  assert.throws(() => createSubjectResolver(null), /must be an object/)
})
