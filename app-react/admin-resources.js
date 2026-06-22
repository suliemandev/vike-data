// The app's admin resources, contributed to vike-admin's cumulative `adminResources`
// point (the same way it contributes its own theme to `themes`). A resource is the
// REFINEMENT on top of a composed-schema table: here, `users` (declared by vike-auth's
// schema) gets a curated list + form. Drop the `list`/`form` and it would still derive a
// full CRUD view from the schema — this just shows the refinement seam.
//
// In a larger app vike-auth could ship this `users` resource itself; contributing it from
// the app keeps the dependency arrow pointing the right way (the app knows about auth and
// admin, not the reverse) and demonstrates the app-contributes path.
import { defineResource, column, field } from 'vike-admin/define'

export const usersResource = defineResource({
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

// A second resource on `sessions` (declared by vike-auth's schema) whose `user_id` column
// references `users.id`. vike-admin renders it as a SELECT of users, labeled by the users
// resource's recordTitle ('email') instead of a raw uuid — the payoff of composed-schema
// FK introspection. The list resolves the same FK to the user's email.
export const sessionsResource = defineResource({
  table: 'sessions',
  label: 'Sessions',
  list: [column('user_id').label('User'), column('token'), column('created_at').format('since')],
  form: [
    field('user_id'), // FK -> rendered as a user picker
    field('token').required(),
  ],
  canView: (user) => !!user,
})
