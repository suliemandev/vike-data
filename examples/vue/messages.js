import { defineMessages } from 'vike-i18n'

export const appMessages = defineMessages({
  en: {
    'app.homeTitle': 'vike-data Vue UI tier',
    'app.signedInAs': 'Signed in as',
    'app.signedOut': 'You are signed out.',
    'app.signInLink': 'Sign in',
    'app.signInPrompt': 'to see the session resolve.',
    'app.blurb':
      'Themes, layouts and translations are all installed and configured like the other extensions. Open the toolbar (bottom-left) to switch language, theme and appearance, all in one place; the login form strings come from vike-auth/vue.',
  },
  fr: {
    'app.homeTitle': 'Niveau UI Vue de vike-data',
    'app.signedInAs': 'Connecté en tant que',
    'app.signedOut': 'Vous êtes déconnecté.',
    'app.signInLink': 'Se connecter',
    'app.signInPrompt': 'pour voir la session se résoudre.',
    'app.blurb':
      "Les thèmes, les mises en page et les traductions sont tous installés et configurés comme les autres extensions. Ouvrez la barre d'outils (en bas à gauche) pour changer de langue, de thème et d'apparence, au même endroit ; les textes du formulaire de connexion proviennent de vike-auth/vue.",
  },
})

export default appMessages
