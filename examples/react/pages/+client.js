// Client entry (runs once in the browser, before any RPC): point telefunc's browser client
// at vike-rbac's relocated Telefunc endpoint (#128), so a telefunction call POSTs to the URL
// our single universal middleware owns in dev AND prod, arriving with the signed-in,
// role-enriched user on the context. See pages/rpc-demo + vike-rbac/telefunc-client.
import 'vike-rbac/telefunc-client'
