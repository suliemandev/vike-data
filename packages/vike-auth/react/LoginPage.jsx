// The /login PAGE, shipped by the extension itself (config.pages, vike#3356) —
// install vike-auth/react and the route appears, no page file in the app. It renders
// the form; the centered shell comes from the page's `layout: 'centered'` (set in
// +config.js) via vike-layouts, and the theme from vike-themes.
import { SignInForm } from './SignInForm.jsx'

export default function LoginPage() {
  return <SignInForm />
}
