// Bridges vike-storage into vike-admin's field-widget registry: registers <FileField> under
// the `file` token, so a column declared `.as('file')` renders the uploader.
//
// The registration is the MODULE side effect (it runs on import). It is exposed as a
// passthrough vike-react Layout so the bridge config (./admin.js) can pull it into EVERY
// page's bundle through the cumulative `Layout` seam - which means the widget is registered in
// BOTH the SSR and the client bundle, so the field renders identically on the server and after
// hydration (no mismatch). The Layout itself renders its children unchanged.
//
// This lives in a SEPARATE bridge (vike-storage/react/admin) rather than vike-storage/react,
// so vike-storage works without vike-admin; installing the bridge is what opts an app into the
// storage-to-admin integration. vike-admin is an optional peer dependency.
import { registerFieldWidget } from 'vike-admin/react/widgets'
import { FileField } from './FileField.jsx'

registerFieldWidget('file', FileField)

export default function AdminFileRegister({ children }) {
  return children
}
