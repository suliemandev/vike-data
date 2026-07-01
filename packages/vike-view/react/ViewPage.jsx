// The generic page shipped for every generated view route. It renders the sections the data hook
// (viewData) hydrated — a thin wrapper over <Blocks>. Importing ./index registers the schema +
// primitive renderers, so every block type in the view resolves to a component. No React import
// (vike-react automatic JSX runtime).
import { useData } from 'vike-react/useData'
import { Blocks } from './index.js'

export default function ViewPage() {
  const data = useData()
  return <Blocks sections={data?.sections ?? []} />
}
