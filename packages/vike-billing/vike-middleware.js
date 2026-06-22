// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-billing/middleware:default`. It binds the reusable webhook factory
// (middleware.js) to the default in-memory billing instance (instance.js).
//
// A real app that wants a database-backed store would call createBillingWebhook
// with its own billing core (a universal-orm `db` over @universal-orm/drizzle).
import { billing } from './instance.js'
import { createBillingWebhook } from './middleware.js'

export default createBillingWebhook(billing)
