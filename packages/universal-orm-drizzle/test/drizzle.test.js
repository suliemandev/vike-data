// The Drizzle adapter against a REAL Postgres (pglite, in-process — no server, no
// network) so the translation is proven, not mocked. It is held to the SAME
// contract as `@universal-orm/memory`, plus the one thing only this adapter has to
// get right: the schema's snake_case column names (`password_hash`) mapping to
// Drizzle's camelCase property keys (`passwordHash`).

import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { pgTable, uuid, varchar, boolean } from 'drizzle-orm/pg-core'
import { createRepository } from '@universal-orm/core'
import { createDrizzleAdapter } from '../src/index.js'

// camelCase property keys, snake_case DB columns — the real generated-schema shape.
const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  active: boolean('active'),
})

// The neutral schema the repository is built from speaks DB names (snake_case).
const schema = {
  tables: [
    {
      table: 'users',
      columns: ['id', 'email', 'name', 'password_hash', 'active'].map((name) => ({ name })),
    },
  ],
}

const ID = '00000000-0000-0000-0000-000000000001'
let client
let db

before(async () => {
  client = new PGlite()
})

beforeEach(async () => {
  await client.exec('drop table if exists users;')
  await client.exec(
    'create table users (id uuid primary key, email varchar(255) unique, name varchar(255), password_hash varchar(255), active boolean);',
  )
  db = createRepository(schema, createDrizzleAdapter(drizzle(client), [users]))
})

test('insert returns the row in neutral (snake_case) shape', async () => {
  const row = await db.users.insert({ id: ID, email: 'a@b.com', name: 'A', password_hash: 'h', active: true })
  assert.equal(row.password_hash, 'h') // snake_case out, not Drizzle's `passwordHash`
  assert.equal(row.email, 'a@b.com')
})

test('find by snake_case column, equality and `in`', async () => {
  await db.users.insert({ id: ID, email: 'a@b.com', password_hash: 'h', active: true })
  assert.equal((await db.users.find({ password_hash: 'h' })).length, 1)
  assert.equal((await db.users.find({ password_hash: 'nope' })).length, 0)
  assert.equal((await db.users.find({ email: { in: ['a@b.com', 'x@y.com'] } })).length, 1)
  assert.equal((await db.users.find()).length, 1)
})

test('findOne returns the first match or null', async () => {
  assert.equal(await db.users.findOne({ id: ID }), null)
  await db.users.insert({ id: ID, email: 'a@b.com', active: true })
  assert.equal((await db.users.findOne({ id: ID })).email, 'a@b.com')
})

test('upsert inserts then updates the conflicting row in place', async () => {
  await db.users.upsert({ id: ID, email: 'a@b.com', name: 'A', active: true }, { onConflict: 'email' })
  await db.users.upsert({ id: ID, email: 'a@b.com', name: 'A2', active: true }, { onConflict: 'email' })
  const all = await db.users.find()
  assert.equal(all.length, 1)
  assert.equal(all[0].name, 'A2')
})

test('update patches matching rows and returns them in neutral shape', async () => {
  await db.users.insert({ id: ID, email: 'a@b.com', password_hash: 'h', active: true })
  const updated = await db.users.update({ id: ID }, { password_hash: 'h2', active: false })
  assert.equal(updated.length, 1)
  assert.equal(updated[0].password_hash, 'h2')
  assert.equal(updated[0].active, false)
})

test('delete removes matching rows and returns the count', async () => {
  await db.users.insert({ id: ID, email: 'a@b.com', active: true })
  await db.users.insert({ id: '00000000-0000-0000-0000-000000000002', email: 'b@b.com', active: false })
  assert.equal(await db.users.delete({ active: false }), 1)
  assert.deepEqual((await db.users.find()).map((r) => r.email), ['a@b.com'])
})

test('an unregistered table is a clear error', async () => {
  await assert.rejects(createDrizzleAdapter(drizzle(client), []).insert('ghost', {}), /no Drizzle table registered for "ghost"/)
})
