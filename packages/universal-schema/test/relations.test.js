// relations v2 follow-ups (#17): self-referential FKs and relation-field naming
// control. Self-relations put both ends on the same model, so the forward +
// inverse field names must stay distinct and the relation name unique; naming
// control lets a declaration replace the auto-generated field names.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '../src/define.js'
import { mergeSchemas, deriveRelations } from '../src/merge.js'
import { toPrisma } from '../src/compilers.js'

const usersWith = (build) => {
  const { tables } = mergeSchemas([defineSchema('users', (t) => {
    t.uuid('id').primary()
    build(t)
  })])
  return { table: tables[0], rels: deriveRelations(tables).get('users') }
}

// ----------------------------------------------------- self-referential FKs ---

test('a self-referential FK derives both a forward and an inverse relation on the same model', () => {
  const { rels } = usersWith((t) => t.uuid('invited_by').nullable().references('users.id'))
  assert.equal(rels.forward.length, 1)
  assert.equal(rels.inverse.length, 1)
  assert.equal(rels.forward[0].owner, 'users')
  assert.equal(rels.forward[0].target, 'users')
})

test('the self-relation renders valid Prisma: distinct field names, one shared relation name', () => {
  const { table, rels } = usersWith((t) => t.uuid('invited_by').nullable().references('users.id', { onDelete: 'set null' }))
  const out = toPrisma(table, rels)
  assert.match(out, /invited_by_ref Users\? @relation\("users_invited_by", fields: \[invited_by\], references: \[id\], onDelete: SetNull\)/)
  assert.match(out, /users_invited_by Users\[\] @relation\("users_invited_by"\)/)
  // the two navigation field names must differ (Prisma rejects duplicates)
  const fields = [...out.matchAll(/^ {2}(\w+) Users/gm)].map((m) => m[1])
  assert.equal(new Set(fields).size, fields.length)
})

test('two self-referential FKs on one table stay collision-free', () => {
  const { table, rels } = usersWith((t) => {
    t.uuid('invited_by').nullable().references('users.id')
    t.uuid('manager_id').nullable().references('users.id')
  })
  const out = toPrisma(table, rels)
  const fields = [...out.matchAll(/^ {2}(\w+) Users/gm)].map((m) => m[1])
  assert.equal(new Set(fields).size, fields.length) // all four distinct
  const relationNames = [...out.matchAll(/@relation\("([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual([...new Set(relationNames)].sort(), ['users_invited_by', 'users_manager_id'])
})

// -------------------------------------------------- relation-field naming -----

test('`as` overrides the forward relation field name', () => {
  const { rels } = usersWith((t) => t.uuid('invited_by').nullable().references('users.id', { as: 'inviter' }))
  assert.equal(rels.forward[0].fieldName, 'inviter')
})

test('`inverseAs` overrides the inverse relation field name', () => {
  const { rels } = usersWith((t) => t.uuid('invited_by').nullable().references('users.id', { inverseAs: 'invitees' }))
  assert.equal(rels.forward[0].inverseFieldName, 'invitees')
})

test('named self-relation reads cleanly in Prisma', () => {
  const { table, rels } = usersWith((t) =>
    t.uuid('invited_by').nullable().references('users.id', { as: 'inviter', inverseAs: 'invitees' }),
  )
  const out = toPrisma(table, rels)
  assert.match(out, /inviter Users\? @relation\("users_invited_by"/)
  assert.match(out, /invitees Users\[\] @relation\("users_invited_by"\)/)
  assert.ok(!out.includes('invited_by_ref')) // the auto name is gone
})

test('naming control works across tables (inverse field on the referenced model)', () => {
  const { tables } = mergeSchemas([
    defineSchema('users', (t) => t.uuid('id').primary()),
    defineSchema('posts', (t) => t.uuid('author_id').references('users.id', { as: 'author', inverseAs: 'posts' })),
  ])
  const rels = deriveRelations(tables)
  assert.equal(rels.get('posts').forward[0].fieldName, 'author')
  const usersOut = toPrisma(tables.find((t) => t.table === 'users'), rels.get('users'))
  assert.match(usersOut, /posts Posts\[\] @relation\("posts_author_id"\)/)
})

test('defaults are unchanged when no naming is given (back-compat)', () => {
  const { rels } = usersWith((t) => t.uuid('manager_id').references('users.id'))
  assert.equal(rels.forward[0].fieldName, 'manager') // _id stripped
  assert.equal(rels.forward[0].inverseFieldName, 'users_manager_id') // relation name
})
