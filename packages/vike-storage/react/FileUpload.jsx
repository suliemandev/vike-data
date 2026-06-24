// <FileUpload> - the React upload control (the standalone analog of vike-push's PushToggle).
// A file input that uploads the chosen file to /uploads and reports the stored URL through
// onUploaded. Thin wrapper over the framework-agnostic client helpers (vike-storage/client);
// imports nothing server-side, so it is safe in the client bundle.
//
// For the vike-admin form field (an `.as('file')` column), see ./FileField.jsx, which wraps
// this same upload flow into a registry widget.
import { useState } from 'react'
import { uploadFile } from '../client.js'

export function FileUpload({ onUploaded, uploadUrl = '/uploads', label = 'Upload a file', accept }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  async function onChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const saved = await uploadFile(file, { uploadUrl })
      setDone(saved)
      onUploaded?.(saved)
    } catch (err) {
      setError(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <label style={{ color: 'var(--color-muted)' }}>
        {label}{' '}
        <input type="file" accept={accept} onChange={onChange} disabled={busy} />
      </label>
      {busy && <span style={{ color: 'var(--color-muted)' }}>Uploading...</span>}
      {done && !busy && (
        <a href={done.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
          {done.filename || 'view'}
        </a>
      )}
      {error && <span style={{ color: '#dc2626' }}>{error}</span>}
    </span>
  )
}

export default FileUpload
