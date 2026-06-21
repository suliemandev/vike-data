// React UI tier for vike-auth: components + hooks over the merged server tier
// (magic-link endpoints + pageContext.user). The headless core stays vike-auth;
// this is the per-framework wrapper (cf. vike-react-query naming).
export { SignInForm } from './SignInForm.jsx'
export { UserButton } from './UserButton.jsx'
export { useUser } from './useUser.js'
