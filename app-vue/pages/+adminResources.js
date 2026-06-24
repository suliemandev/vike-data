import { defineResource, column, field } from 'vike-admin/define'
import { can, hasRole } from 'vike-rbac'

const usersResource = defineResource({
  table: 'users',
  label: 'Users',
  recordTitle: 'email',
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
  ],
  canView: (user) => can(user, 'users.view'),
  canEdit: (user) => can(user, 'users.edit'),
})

const sessionsResource = defineResource({
  table: 'sessions',
  label: 'Sessions',
  list: [column('user_id').label('User'), column('token'), column('created_at').format('since')],
  form: [
    field('user_id'),
    field('token').required(),
  ],
  canView: (user) => !!user,
  scope: (user) => (hasRole(user, 'admin') ? null : { user_id: user.id }),
})

export default [usersResource, sessionsResource]
