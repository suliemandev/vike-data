// The page-generation glue (plain logic — the Vike hook/JSX aren't imported here): viewPages
// builds config.pages from views, viewForRoute resolves a route back to its view, and
// formFieldsFor finds a form block's fields for the POST handler.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSchema } from '@vike-data/vike-schema/schema'
import { defineView, crudBlocks, resolveViewTables } from '../index.js'
import { viewPages, viewForRoute, normalizeViews, formFieldsFor } from '../react/pages.js'

const posts = defineSchema('posts', (t) => {
  t.uuid('id').primary()
  t.string('title')
  t.string('status').as('enum', { values: ['draft', 'published'] })
  t.timestamps()
})
const tables = () => resolveViewTables({ schemas: [posts] })

const postsView = defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) })
const dashView = defineView({ route: '/dash', sections: [{ block: 'markdown', source: '# Hi' }] })

test('viewPages builds one page per view route, sharing the generic Page + data hook', () => {
  const pages = viewPages([postsView, dashView])
  assert.deepEqual(pages.map((p) => p.route), ['/posts', '/dash'])
  assert.equal(pages[0].Page, 'import:vike-view/react/ViewPage:default')
  assert.equal(pages[0].data, 'import:vike-view/react/viewData:viewData')
})

test('viewPages skips a view with no route, and flattens cumulative contributions', () => {
  const routeless = defineView({ sections: [{ block: 'markdown', source: 'x' }] })
  const pages = viewPages([[postsView], routeless, () => [dashView]]) // arrays + a fn contribution
  assert.deepEqual(pages.map((p) => p.route), ['/posts', '/dash'])
})

test('normalizeViews flattens arrays and function contributions, dropping empties', () => {
  assert.deepEqual(normalizeViews([postsView, [dashView], null, () => [postsView]]).map((v) => v.route), ['/posts', '/dash', '/posts'])
})

test('viewForRoute resolves a route back to its view', () => {
  assert.equal(viewForRoute([postsView, dashView], '/dash'), dashView)
  assert.equal(viewForRoute([postsView], '/nope'), null)
})

test('formFieldsFor returns the form block’s resolved fields for the table', () => {
  const fields = formFieldsFor(postsView, tables(), 'posts')
  assert.ok(fields.some((f) => f.name === 'title'))
  // the enum field resolves to a select widget
  assert.equal(fields.find((f) => f.name === 'status').widget, 'enum')
  assert.equal(formFieldsFor(postsView, tables(), 'ghosts'), null)
})
