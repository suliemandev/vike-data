// The login page is just its content: the centered shell comes from this page's
// config (layout: 'centered' in +config.js) via vike-react-layouts, and the theme
// from vike-themes/react. The page only renders the form.
import { SignInForm } from 'vike-react-auth'

export default function LoginPage() {
  return <SignInForm appName="Acme" />
}
