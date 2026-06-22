// The app's contribution to vike-admin's cumulative `adminResources` point. It lives in
// its own +<configName>.js file (not inline in +config.js) because a resource carries
// FUNCTIONS — canView / canEdit predicates, the column/field builders — which Vike cannot
// serialize into the page config; a dedicated file is pointer-imported instead. Same seam
// as `themes` / `messages`, just runtime values rather than plain data.
import { usersResource } from '../admin-resources.js'

export default [usersResource]
