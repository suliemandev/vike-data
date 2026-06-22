// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-stripe/subscription/middleware:default`. Binds the webhook factory
// to the default in-memory subscription instance.
import { subscriptions } from './instance.js'
import { createSubscriptionWebhook } from './middleware.js'

export default createSubscriptionWebhook(subscriptions)
