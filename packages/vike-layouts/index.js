// vike-layouts — the framework-agnostic LAYOUT core.
//
// Layout and theme are orthogonal (issue #25): layout is WHERE things go (logo,
// nav, footer, user menu placement); theme is HOW it looks (#24, vike-themes).
// A sidebar layout + dark theme compose, as do a centered layout + light theme.
//
// This core owns only the framework-agnostic half: the shell REGISTRY (which
// shells exist and which slots each renders) and the SELECTION + SLOT config an
// app provides. The actual shell components are per-framework UI and live in a
// subpath (vike-layouts/react) — exactly the core/UI split the rest of the Stem
// set uses, so a future vike-layouts/vue reuses this selection logic unchanged.

// kind: 'public' shells (logo only, no app nav) bridge to auth/marketing pages;
// 'app' shells carry the signed-in chrome. slots: which slots the shell renders.
const SHELLS = {
  // centered/blank — public + auth pages: a clean centered card, logo only. This
  // is exactly what vike-auth/react's login page wants.
  centered: { kind: 'public', slots: ['logo'] },
  // topbar — app shell: horizontal nav across the top.
  topbar: { kind: 'app', slots: ['logo', 'nav', 'userMenu', 'footer'] },
  // sidebar — app shell: vertical nav down the side.
  sidebar: { kind: 'app', slots: ['logo', 'nav', 'userMenu', 'footer'] },
}

/** The registered shells (a copy — mutate via registerShell, not this object). */
export function shells() {
  return { ...SHELLS }
}

/**
 * Register a shell so a third-party package can add a 4th (the registry is kept
 * OPEN on purpose — #25). `spec` = { kind: 'app'|'public', slots: string[] }.
 */
export function registerShell(name, spec) {
  if (!name || typeof name !== 'string') throw new Error('[vike-layouts] registerShell: name must be a non-empty string')
  if (!spec || !Array.isArray(spec.slots)) throw new Error('[vike-layouts] registerShell: spec.slots must be an array')
  SHELLS[name] = { kind: spec.kind === 'app' ? 'app' : 'public', slots: [...spec.slots] }
  return SHELLS[name]
}

/** True if `name` is an app (signed-in chrome) shell rather than a public one. */
export function isAppShell(name) {
  return SHELLS[name]?.kind === 'app'
}

/**
 * Resolve an app's layout config into a normalized descriptor a shell renders
 * from. Unknown/missing shells fall back to `centered` (the safe public default).
 * `dir` carries the rtl/ltr concern (a layout responsibility, #25).
 *
 *   defineLayout({ shell: 'topbar', logo: 'Acme', nav: [{label,href}], dir: 'rtl' })
 */
export function defineLayout(config = {}) {
  const shell = config.shell && SHELLS[config.shell] ? config.shell : 'centered'
  const spec = SHELLS[shell]
  return {
    shell,
    kind: spec.kind,
    dir: config.dir === 'rtl' ? 'rtl' : 'ltr',
    // Only the slots this shell actually renders are kept, so a centered shell
    // silently ignores nav/userMenu an app passed for its app shells.
    slots: {
      logo: spec.slots.includes('logo') ? config.logo ?? null : null,
      nav: spec.slots.includes('nav') ? config.nav ?? [] : [],
      footer: spec.slots.includes('footer') ? config.footer ?? [] : [],
      userMenu: spec.slots.includes('userMenu') ? config.userMenu ?? null : null,
    },
  }
}
