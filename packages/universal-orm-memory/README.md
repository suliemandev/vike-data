# @universal-orm/memory

The in-process adapter for [`@vike-data/universal-orm`](../universal-orm). It runs
the neutral repository calls against plain in-memory `Map`s — no database, no ORM.
It is the adapter the tests, the demo app, and the proof run on.

```js
import { createRepository } from '@vike-data/universal-orm'
import { createMemoryAdapter } from '@universal-orm/memory'

const db = createRepository({ tables }, createMemoryAdapter())
await db.users.insert({ id: 'u1', email: 'a@b.com', active: true })
```

It honours the same five-operation contract every adapter must, and reuses
universal-orm's shared `matchesFilter`, so its notion of a filter is identical to
every other in-process adapter. Swapping in [`@universal-orm/drizzle`](../universal-orm-drizzle)
for a real database changes only this one line — the extension code calling
`db.<table>.<op>` does not change.

Rows are copied on the way in and out, so mutating a caller's object (or a returned
row) never reaches back into the store.
