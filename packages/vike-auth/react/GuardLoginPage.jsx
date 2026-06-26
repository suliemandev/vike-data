// The login PAGE for a named guard (#267) — vike-auth owns the login UI; the APP owns the
// route. The app contributes a page entry (`route: '/admin/login'`, `Page:` this component,
// `authGuard: 'admin'`) for each guard, because the extension can't statically know the
// guard names. This component reads the guard name off the page config (`authGuard`) and
// points the SignInForm at that guard's endpoint (`/admin-auth/request`), so the form posts
// to the right guard with no app glue.
//
// It is the multi-guard twin of LoginPage.jsx (which renders the default `/login`). Same
// form, themed shell from the page's `layout: 'centered'`; only the action endpoint and
// the heading differ per guard.
import { usePageContext } from 'vike-react/usePageContext'
import { SignInForm } from './SignInForm.jsx'

export default function GuardLoginPage() {
  const pageContext = usePageContext()
  const guard = pageContext.config?.authGuard
  // Each guard owns the endpoint namespace `/<name>-auth/*` (guards.js); the form posts the
  // email there so the right guard issues the magic link and sets the right cookie.
  return <SignInForm action={`/${guard}-auth/request`} appName={guard} />
}
