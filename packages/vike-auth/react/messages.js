// vike-auth/react's strings — ENGLISH ONLY (the base + fallback locale). The
// extension owns its keys (under `auth.*`) and ships `en`; other languages are
// separate, installable LOCALE PACKS that contribute their translations to the
// cumulative `messages` config (e.g. vike-react-auth-fr), exactly the way theme
// packages compose. So an app bundles only the languages it installs, and a
// missing key in a pack falls back to this English (see vike-i18n mergeMessages).
import { defineMessages } from 'vike-i18n'

export const authMessages = defineMessages({
  en: {
    'auth.signIn': 'Sign in to {app}',
    'auth.subtitle': 'Passwordless. We email you a one-time link.',
    'auth.email': 'Email',
    'auth.send': 'Send magic link',
    'auth.sending': 'Sending...',
    'auth.inboxTitle': 'Check your inbox',
    'auth.inboxBody': 'We sent a sign-in link to {email}.',
    'auth.devNote': 'In dev no email is sent. The magic link is printed in the server console.',
    'auth.different': 'Use a different email',
    'auth.error': 'Something went wrong. Please try again.',
    'auth.footer': 'Served by the vike-auth extension.',
    'auth.signInShort': 'Sign in',
    'auth.logout': 'Log out',
    'auth.accountTitle': 'Your account',
    'auth.accountSignedInAs': 'Signed in as',
    'auth.accountName': 'Name',
    'auth.accountSignedOut': 'You are not signed in.',
  },
})

export default authMessages
