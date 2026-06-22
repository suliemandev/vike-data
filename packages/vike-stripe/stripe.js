// The shared Stripe SDK seam — the reason vike-stripe is ONE package: every billing
// model (subscription, purchase) talks to Stripe through this single place,
// rather than each subpath pulling its own copy.
//
// A real vike-stripe would import the official `stripe` package here and verify the
// webhook signature with `stripe.webhooks.constructEvent(rawBody, sig, secret)`. In
// this proof there is no network and no signature — `constructEvent` just parses the
// JSON body — but the SHAPE is the real one, so swapping in the real SDK is a local
// change confined to this file.
//
// Provider seam: Stripe is the baked-in default. Another provider (vike-paddle)
// would be its own package exposing the same `createBillingProvider`-shaped surface,
// so an app swaps the provider without the billing models changing. We keep that
// seam in mind but do not build the neutral layer yet.
export function createStripe({ apiKey } = {}) {
  return {
    apiKey: apiKey ?? null,
    webhooks: {
      // Real: stripe.webhooks.constructEvent(rawBody, signature, endpointSecret),
      // which verifies the signature and returns the typed event. Here: parse JSON.
      async constructEvent(request) {
        return request.json()
      },
    },
  }
}

// The default shared instance the subpath wirings use.
export const stripe = createStripe({ apiKey: process.env.STRIPE_API_KEY })
