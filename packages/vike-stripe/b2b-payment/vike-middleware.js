// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-stripe/b2b-payment/middleware:default`. Binds the webhook factory to
// the default in-memory payment instance.
import { payments } from './instance.js'
import { createPaymentWebhook } from './middleware.js'

export default createPaymentWebhook(payments)
