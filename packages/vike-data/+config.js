// vike-data: the data-layer extension.
//
// Its job here is to DEFINE the contribution point: a custom CUMULATIVE config
// named `migrations`. Any extension or the app can add to it, and Vike merges
// every contribution into one array. The host also seeds its own baseline
// migration.
//
// (It also ships the neutral schema DSL + compilers at `vike-data/schema` for
// now; that subpath can be split into a standalone `vike-schema` package later.)
//
// (The consumer that reads the merged list lives in a +onRenderHtml.js hook.
// Vike requires hooks to be separate files, not inline functions in a config,
// because config values get serialized. In a published extension the host would
// ship that hook itself; here it lives in the app for simplicity.)
export default {
  name: 'vike-data',

  meta: {
    migrations: {
      // config: available at config-time; server: available in server hooks.
      env: { config: true, server: true },
      // THE crux: accumulate values from every source instead of overriding.
      cumulative: true,
    },
  },

  // The host contributes its own baseline migration.
  migrations: ['000_create_migrations_table'],
}
