// A second feature extension (think: a billing package). Contributes its own
// migration to the host's cumulative point. The `001_` prefix deliberately
// collides with auth's first migration, so the spike shows how/whether Vike
// surfaces ordering + naming conflicts across independent extensions.
export default {
  name: 'example-billing',
  migrations: ['001_create_subscriptions_table'],
}
