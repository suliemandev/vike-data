// Registers vike-storage's <FileField> upload control into the shared field-widget registry
// under the `file` token, so a column declared `.as('file')` renders the uploader in ANY
// consumer that reads the registry (vike-admin today; a future vike-landing / vike-email-editor).
//
// It registers into `@vike-data/kit`'s 'react' registry directly, so vike-storage depends only
// on kit (already a dependency) and NOT on vike-admin: neither core knows about the other, and a
// new consumer gets `.as('file')` for free with no per-consumer bridge (the Option D shape, #185).
//
// The registration is the MODULE side effect (it runs on import). It is exposed as a passthrough
// vike-react Layout so the per-framework config (./+config.js) can pull it into EVERY page's
// bundle through the cumulative `Layout` seam, which means the widget is registered in BOTH the
// SSR and the client bundle, so the field renders identically on the server and after hydration
// (no mismatch). The Layout itself renders its children unchanged.
//
// Lives in vike-storage's react subpath (not the framework-agnostic core), so vike-storage works
// headless without any UI; installing `vike-storage/react` is what opts an app into the rendered
// upload control.
import { createFieldWidgetRegistry } from '@vike-data/kit'
import { FileField } from './FileField.jsx'

createFieldWidgetRegistry('react').register('file', FileField)

export default function FieldWidgetRegister({ children }) {
  return children
}
