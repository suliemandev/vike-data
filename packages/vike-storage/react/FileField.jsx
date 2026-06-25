// <FileField> - the form widget for a column declared `.as('file')` (#176/#177/#185). It is the
// proof that the shared field-widget registry is third-party-extensible: vike-storage registers
// this under the `file` token in `@vike-data/kit`'s registry (see ./FieldWidgetRegister.jsx), so
// any `.as('file')` column renders an uploader in any consumer (vike-admin today) with NO
// bespoke code.
//
// The control submits a string column value: it uploads the chosen file to /uploads and keeps
// the returned URL in a hidden input named for the field, so the admin form posts that URL as
// the column value exactly like any text field. `value` pre-fills the current URL on edit.
// Imports only the client helpers (no server module), so the admin client bundle stays clean.
import { useState } from 'react'
import { uploadFile } from '../client.js'

const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }

export function FileField({ field, value }) {
  const [url, setUrl] = useState(value ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const saved = await uploadFile(file)
      setUrl(saved.url)
    } catch (err) {
      setError(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label style={labelStyle} htmlFor={field.name}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {/* The actual column value the form submits: the stored URL. */}
      <input type="hidden" name={field.name} value={url} />
      <input id={field.name} type="file" onChange={onChange} disabled={busy} />
      {busy && <span style={{ color: 'var(--color-muted)', fontSize: 12, marginLeft: 8 }}>Uploading...</span>}
      {url && !busy && (
        <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontSize: 12, marginLeft: 8 }}>
          current file
        </a>
      )}
      {error && <span style={{ color: '#dc2626', fontSize: 12, marginLeft: 8 }}>{error}</span>}
    </div>
  )
}

export default FileField
