// SPIKE (#79): the crux test. Does `effect()` on a config let us CONDITIONALLY pull in
// modules (extends) based on a config value — so `lang: ['ar']` auto-includes only the
// `ar` pack and nothing else (preserving #76's tree-shaking)?
//
// `lang` is a config-env value. Its effect() reads the requested locales and returns
// `extends` pointing at the matching packs from a (hardcoded-for-the-spike) registry.
// Each pack contributes to the cumulative `langMarker` config; the probe reads
// pageContext.config.langMarker to see which packs actually composed in.
//
// For the spike the registry is inline; in the real design each extension would ADVERTISE
// its locale pointers through a cumulative registry. We isolate ONE question here:
// can effect() return `extends`?

// locale -> pointer-import of that pack's Vike config.
const REGISTRY = {
  ar: 'import:spike-lang/pack-ar:default',
  fr: 'import:spike-lang/pack-fr:default',
}

export default {
  name: 'spike-lang',

  meta: {
    lang: {
      env: { config: true },
      // The whole bet: return `extends` computed from the value. If Vike resolves these
      // pointer-imports as real config composition, the matching packs' langMarker
      // contributions appear downstream.
      // FINDINGS (Vike 0.4.259):
      //   - effect() RUNS at config-time and can return a config object.
      //   - returning `extends` is SILENTLY IGNORED (extends/module composition is resolved
      //     in an earlier phase than effect() runs) -> the pack never composes in.
      //   - returning a CUMULATIVE config value (e.g. `langMarker`) CRASHES Vike
      //     ("You stumbled upon a Vike bug", sortPlusFilesSameLocationId).
      // => config-value-driven conditional `extends` is NOT achievable in userland today.
      effect({ configValue, configDefinedAt }) {
        const locales = Array.isArray(configValue) ? configValue : []
        const extendsList = locales.map((l) => REGISTRY[l]).filter(Boolean)
        console.error('[spike-lang] effect ran', { configValue, configDefinedAt, extendsList })
        if (!extendsList.length) return
        return { extends: extendsList } // ignored by Vike — see findings above
      },
    },
    langMarker: {
      env: { server: true, config: true },
      cumulative: true,
    },
  },

  lang: [],
  langMarker: ['base'],
}
