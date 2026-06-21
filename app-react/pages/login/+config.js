// Per-page layout override: the login page wants the centered (public) shell, not
// the app's default topbar. This is plain Vike config inheritance — most-specific
// wins — the same mechanism billing/auth options use.
export default {
  layout: 'centered',
}
