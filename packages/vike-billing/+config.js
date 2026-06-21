// vike-billing — the third leg of the composition proof. It composes on vike-auth
// and/or vike-teams: a `subscriptions` table whose FK points at the billing
// subject (an organization by default, B2B).
//
// The default export bills per-ORGANIZATION (Rom confirmed the B2B focus) and
// installs like any extension. The per-USER variant — and the parameterization
// story + Vike binding constraint behind it — lives in ./billing.js (billingFor),
// used by vike-data's codegen driver. Vike +config files must export only a
// default, so the factory is kept out of this file.
import { billingFor } from './billing.js'

export default billingFor('organization')
