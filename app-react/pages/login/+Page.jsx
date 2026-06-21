// The login page: the centered (public) layout shell + the themed <SignInForm>.
// This is the demo's headline — three independent extensions composing on one
// page: vike-layouts picks the shell, vike-themes styles it, vike-react-auth
// owns the flow. Swap the theme (toggle bottom-right) and the whole card restyles.
import { Layout } from 'vike-react-layouts'
import { SignInForm } from 'vike-react-auth'

export default function LoginPage() {
  return (
    <Layout shell="centered" logo="◆ Acme">
      <SignInForm heading="Sign in to Acme" />
    </Layout>
  )
}
