// useUser() — read the current user the vike-auth SERVER tier resolved from the
// session cookie. vike-auth's onCreatePageContext puts a plain { id, email, name }
// (or null) on pageContext.user; this just surfaces it to React via vike-react's
// usePageContext. The UI never touches sessions/tokens — it reads one field.
import { usePageContext } from 'vike-react/usePageContext'

export function useUser() {
  const pageContext = usePageContext()
  return pageContext?.user ?? null
}
