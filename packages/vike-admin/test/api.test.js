// The agent-API middleware's pure helpers (#113): URL -> page-route mapping and the row
// projection that keeps the JSON from leaking columns the admin hides. The middleware
// itself is exercised end-to-end against the running app (renderPage needs Vike); here we
// pin the framework-free pieces.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageRouteFor, projectRows, writeTargetFor } from '../api.js'

test('pageRouteFor maps only /admin*.json paths to their page route', () => {
  assert.equal(pageRouteFor('/admin.json'), '/admin')
  assert.equal(pageRouteFor('/admin/users.json'), '/admin/users')
  assert.equal(pageRouteFor('/admin/sessions.json'), '/admin/sessions')
  // not an admin JSON endpoint -> null (request falls through to Vike)
  assert.equal(pageRouteFor('/admin'), null)
  assert.equal(pageRouteFor('/admin/users'), null)
  assert.equal(pageRouteFor('/admin/users/new.json'), null) // nested, not a resource list
  assert.equal(pageRouteFor('/other.json'), null)
})

test('writeTargetFor maps a method + path to its page route, action and body need', () => {
  assert.deepEqual(writeTargetFor('/admin/users.json', 'POST'), { pageRoute: '/admin/users/new', action: 'create', hasBody: true })
  assert.deepEqual(writeTargetFor('/admin/users/u1.json', 'PATCH'), { pageRoute: '/admin/users/u1', action: 'update', hasBody: true })
  assert.deepEqual(writeTargetFor('/admin/users/u1.json', 'PUT'), { pageRoute: '/admin/users/u1', action: 'update', hasBody: true })
  assert.deepEqual(writeTargetFor('/admin/users/u1.json', 'DELETE'), { pageRoute: '/admin/users/u1', action: 'delete', hasBody: false })
  // wrong shape for the verb -> null (the middleware turns that into a 405)
  assert.equal(writeTargetFor('/admin/users.json', 'PATCH'), null) // no id to update
  assert.equal(writeTargetFor('/admin/users/u1.json', 'POST'), null) // create has no id
  assert.equal(writeTargetFor('/admin.json', 'POST'), null) // dashboard isn't writable
  assert.equal(writeTargetFor('/admin/users.json', 'GET'), null) // GET is a read, not a write
})

test('projectRows narrows each row to its visible columns plus the primary key', () => {
  const data = {
    table: 'users',
    pk: 'id',
    columns: [
      { name: 'email', label: 'Email', type: 'string' },
      { name: 'name', label: 'Name', type: 'string' },
    ],
    rows: [
      // password_hash and a stray internal column must NOT survive into the JSON.
      { id: 'u1', email: 'a@b.com', name: 'Ada', password_hash: 'secret', internal_flag: true },
      { id: 'u2', email: 'c@d.com', name: 'Alan', password_hash: 'secret2' },
    ],
    total: 2,
    page: 1,
    pageCount: 1,
    pageSize: 20,
    sort: null,
    dir: 'asc',
  }
  const out = projectRows(data)
  assert.deepEqual(out.rows, [
    { id: 'u1', email: 'a@b.com', name: 'Ada' },
    { id: 'u2', email: 'c@d.com', name: 'Alan' },
  ])
  // columns are reduced to name/label/type (no builder internals); paging carried through.
  assert.deepEqual(out.columns, [
    { name: 'email', label: 'Email', type: 'string' },
    { name: 'name', label: 'Name', type: 'string' },
  ])
  assert.equal(out.total, 2)
  assert.equal(out.table, 'users')
})
