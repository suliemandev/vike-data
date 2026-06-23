// The app's contribution to vike-admin's cumulative `adminResources` point. It lives in
// its own +<configName>.js file (not inline in +config.js) because a resource carries
// FUNCTIONS — canView / canEdit predicates, the column/field builders — which Vike cannot
// serialize into the page config; a dedicated file is pointer-imported instead. Same seam
// as `themes` / `messages`, just runtime values rather than plain data.
//
// A resource is the REFINEMENT on top of a composed-schema table: here, `users` and
// `sessions` (both declared by vike-auth's schema) get curated lists + forms. Drop the
// `list`/`form` and each would still derive a full CRUD view from the schema — this just
// shows the refinement seam. In a larger app vike-auth could ship these resources itself;
// contributing them from the app keeps the dependency arrow pointing the right way (the
// app knows about auth and admin, not the reverse).
import { defineResource, column, field } from 'vike-admin/define'

const usersResource = defineResource({
  table: 'users',
  label: 'Users',
  recordTitle: 'email', // how a user is labeled where it's referenced (e.g. the sessions FK select)
  list: [
    column('email').sortable().searchable(),
    column('name'),
    column('active'),
    column('created_at').label('Joined').format('since'),
  ],
  form: [
    field('email').type('email').required(),
    field('name'),
    field('active'),
    // id / password_hash / timestamps are auto-hidden by convention.
  ],
  canView: (user) => !!user,
})

// A second resource on `sessions` whose `user_id` column references `users.id`. vike-admin
// renders it as a SELECT of users, labeled by the users resource's recordTitle ('email')
// instead of a raw uuid — the payoff of composed-schema FK introspection. The list resolves
// the same FK to the user's email.
const sessionsResource = defineResource({
  table: 'sessions',
  label: 'Sessions',
  list: [column('user_id').label('User'), column('token'), column('created_at').format('since')],
  form: [
    field('user_id'), // FK -> rendered as a user picker
    field('token').required(),
  ],
  canView: (user) => !!user,
})

export default [usersResource, sessionsResource]
