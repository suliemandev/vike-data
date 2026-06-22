// vike-auth-fr — a LOCALE PACK for vike-auth. It ships nothing but the French
// translations of vike-auth's `auth.*` keys and registers them into the
// cumulative `messages` config (see +config.js). Install it and the auth UI speaks
// French; don't, and it stays English. Framework-agnostic message data (no React),
// so it serves vike-auth/react and a future vike-auth/vue alike. This is the
// translation mirror of a theme package: opt-in, composable, independently
// publishable (a native speaker can own it without touching the core auth package).
//
// Keys must match vike-auth/react's; any it omits fall back to English via
// vike-i18n's mergeMessages, so a pack can lag a new string without breaking.
import { defineMessages } from 'vike-i18n'

export const authMessagesFr = defineMessages({
  fr: {
    'auth.signIn': 'Connexion à {app}',
    'auth.subtitle': 'Sans mot de passe. Nous vous envoyons un lien à usage unique.',
    'auth.email': 'E-mail',
    'auth.send': 'Envoyer le lien',
    'auth.sending': 'Envoi...',
    'auth.inboxTitle': 'Vérifiez votre boîte mail',
    'auth.inboxBody': 'Nous avons envoyé un lien de connexion à {email}.',
    'auth.devNote': "En dev, aucun e-mail n'est envoyé. Le lien est affiché dans la console du serveur.",
    'auth.different': 'Utiliser une autre adresse',
    'auth.error': "Une erreur s'est produite. Veuillez réessayer.",
    'auth.footer': "Fourni par l'extension vike-auth.",
    'auth.signInShort': 'Se connecter',
    'auth.logout': 'Déconnexion',
  },
})

export default authMessagesFr
