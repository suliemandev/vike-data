// vike-blocks is a plain library, not a Vike extension, so there is nothing to `extends` here
// beyond the React renderer — the pages import <Page>/<Blocks> and the block builders directly.
import vikeReact from 'vike-react/config'

export default {
  extends: [vikeReact],
  title: 'vike-blocks example',
}
