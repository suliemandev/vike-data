// French catalog for vike-auth's `auth.*` keys. Framework-agnostic message DATA
// (no React), so it serves vike-auth/react and a future vike-auth/vue alike. Keys
// it omits (e.g. the account.* set) fall back to the English shipped INLINE by the
// components, via vike-i18n's mergeMessages + the useTranslation fallback.
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
