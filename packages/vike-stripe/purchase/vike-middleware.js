// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-stripe/purchase/middleware:default`. Binds the webhook factory to
// the default in-memory payment instance.
import { payments } from './instance.js'
import { createPurchaseWebhook } from './middleware.js'

export default createPurchaseWebhook(payments)
