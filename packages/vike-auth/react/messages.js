// vike-auth/react's strings — ENGLISH ONLY (the inline default + universal
// fallback). The extension owns its keys (under `auth.*`). This catalog is passed
// INLINE to useTranslation (not contributed to the cumulative `messages`), so the
// UI renders standalone English with no i18n runtime. Other languages are SUBPATHS
// of this package (vike-auth/fr, vike-auth/ar) that DO contribute to `messages`;
// any key a language omits falls back to this English (see vike-i18n's translate +
// the useTranslation fallback). Languages are the translation mirror of the
// framework axis (vike-auth/react), composed the same way.
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
