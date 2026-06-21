// vike-react provides the React renderer; vike-auth contributes the server tier
// (the /auth/* universal middleware + the onCreatePageContext that resolves the
// session cookie to pageContext.user). The app then renders the vike-react-auth
// components against that one field — it knows nothing about how auth works.
import vikeReact from 'vike-react/config'
import authExt from 'vike-auth/config'

export default {
  extends: [vikeReact, authExt],
  title: 'vike-data — React UI tier',
}
