// parseListQuery — the `?query=` parser/validator that guards the agent API (#113).
// It accepts only the narrow universal-orm surface (#86: equality + `in`, orderBy on a
// sortable column, limit/offset) and rejects anything else with a QueryError, so a
// caller can never smuggle an unknown column, an arbitrary operator, or SQL.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseListQuery, QueryError, MAX_LIMIT } from '../query.js'

// email is sortable; name + active are filterable but not sortable.
const columns = [
  { name: 'email', sortable: true },
  { name: 'name', sortable: false },
  { name: 'active', sortable: false },
]
const q = (obj) => JSON.stringify(obj)

test('no query is an empty filter', () => {
  assert.deepEqual(parseListQuery(undefined, columns), { filter: {} })
  assert.deepEqual(parseListQuery('', columns), { filter: {} })
})

test('equality and `in` filters on known columns pass through', () => {
  assert.deepEqual(parseListQuery(q({ filter: { email: 'a@b.com', active: true } }), columns), {
    filter: { email: 'a@b.com', active: true },
  })
  assert.deepEqual(parseListQuery(q({ filter: { name: { in: ['Ada', 'Alan'] } } }), columns), {
    filter: { name: { in: ['Ada', 'Alan'] } },
  })
})

test('an unknown filter column is rejected', () => {
  assert.throws(() => parseListQuery(q({ filter: { nope: 1 } }), columns), QueryError)
})

test('an operator other than `in` is rejected', () => {
  assert.throws(() => parseListQuery(q({ filter: { email: { like: 'a%' } } }), columns), QueryError)
  assert.throws(() => parseListQuery(q({ filter: { email: { gt: 1 } } }), columns), QueryError)
})

test('`in` must be an array of scalars', () => {
  assert.throws(() => parseListQuery(q({ filter: { name: { in: 'Ada' } } }), columns), QueryError)
  assert.throws(() => parseListQuery(q({ filter: { name: { in: [{}] } } }), columns), QueryError)
})

test('orderBy is honoured only on a sortable column', () => {
  assert.deepEqual(parseListQuery(q({ orderBy: { column: 'email', dir: 'desc' } }), columns), {
    filter: {},
    orderBy: [{ column: 'email', dir: 'desc' }],
  })
  // a string shorthand defaults to ascending
  assert.deepEqual(parseListQuery(q({ orderBy: 'email' }), columns).orderBy, [{ column: 'email', dir: 'asc' }])
  // a non-sortable column is rejected
  assert.throws(() => parseListQuery(q({ orderBy: 'name' }), columns), QueryError)
  // a bad direction is rejected
  assert.throws(() => parseListQuery(q({ orderBy: { column: 'email', dir: 'sideways' } }), columns), QueryError)
})

test('limit is capped at MAX_LIMIT and offset must be a non-negative integer', () => {
  assert.equal(parseListQuery(q({ limit: 5 }), columns).limit, 5)
  assert.equal(parseListQuery(q({ limit: 10000 }), columns).limit, MAX_LIMIT)
  assert.equal(parseListQuery(q({ offset: 40 }), columns).offset, 40)
  assert.throws(() => parseListQuery(q({ limit: -1 }), columns), QueryError)
  assert.throws(() => parseListQuery(q({ offset: 1.5 }), columns), QueryError)
})

test('malformed input is a QueryError, not a crash', () => {
  assert.throws(() => parseListQuery('{not json', columns), QueryError)
  assert.throws(() => parseListQuery(q([1, 2, 3]), columns), QueryError) // array, not object
  assert.throws(() => parseListQuery(q({ filter: 'nope' }), columns), QueryError)
})
