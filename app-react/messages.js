// The app's OWN translations, contributed to the cumulative `messages` config
// alongside every extension's. Keys under `app.*`; the app could also override an
// extension key here (e.g. set 'auth.footer') to retranslate it.
import { defineMessages } from 'vike-i18n'

export const appMessages = defineMessages({
  en: {
    'app.homeTitle': 'vike-data React UI tier',
    'app.signedInAs': 'Signed in as',
    'app.signedOut': 'You are signed out.',
    'app.signInLink': 'Sign in',
    'app.signInPrompt': 'to see the session resolve.',
    'app.blurb':
      'Themes, layouts and translations are all installed and configured like the other extensions. Open the toolbar (bottom-left) to switch language, theme and appearance, all in one place; the login form strings come from vike-auth/react.',
  },
  fr: {
    'app.homeTitle': 'Niveau UI React de vike-data',
    'app.signedInAs': 'Connecté en tant que',
    'app.signedOut': 'Vous êtes déconnecté.',
    'app.signInLink': 'Se connecter',
    'app.signInPrompt': 'pour voir la session se résoudre.',
    'app.blurb':
      "Les thèmes, les mises en page et les traductions sont tous installés et configurés comme les autres extensions. Ouvrez la barre d'outils (en bas à gauche) pour changer de langue, de thème et d'apparence, au même endroit ; les textes du formulaire de connexion proviennent de vike-auth/react.",
  },
})

export default appMessages
