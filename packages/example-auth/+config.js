// A feature extension (think: an auth package). It ships its own tables by
// contributing to the host's cumulative `migrations` point. It does NOT know
// about any other extension.
//
// NOTE: ideally this would also `extends: ['vike-data/config']` so installing
// auth pulls vike-data in automatically. From source that fails: Vike runs its
// import->pointer transform only on the app's own +config files, not on
// extension +config files loaded from node_modules (those are expected to be
// pre-built by Vike's build tooling). So for this spike the app wires vike-data
// in directly. That gap is itself a finding worth confirming with Vike.
export default {
  name: 'example-auth',
  migrations: ['001_create_users_table', '002_create_sessions_table'],
}
