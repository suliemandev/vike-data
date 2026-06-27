// Home: the org-owned uploads proof (#284 / #250). A file uploaded here belongs to the whole
// ORGANIZATION, not the member who uploaded it — so any member sees and can delete any other
// member's file. Sign in as Ada (org owner), upload a file, log out, sign in as Grace (member):
// Grace sees Ada's file in the same list and can delete it. That cross-member visibility is what
// owner-arity (#250) buys over the default user-owned path.
import { useState } from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { useData } from 'vike-react/useData'
import { FileUpload } from 'vike-storage/react/FileUpload'
import { deleteUpload } from 'vike-storage/client'

const card = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius, 10px)',
  padding: 'var(--space-md, 1rem)',
  marginTop: '0.75rem',
}

function OrgFiles({ org, members, initialUploads }) {
  const [uploads, setUploads] = useState(initialUploads)

  async function onDelete(id) {
    await deleteUpload(id)
    setUploads((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <strong style={{ color: 'var(--color-text)' }}>{org.name} files</strong>
        <FileUpload
          label={`Upload to ${org.name}`}
          onUploaded={(saved) =>
            setUploads((prev) => [{ id: saved.id, filename: saved.filename, mime: saved.mime, size: saved.size, url: saved.url }, ...prev])
          }
        />
      </div>
      <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
        Owned by the <strong style={{ color: 'var(--color-text)' }}>{org.name}</strong> organization — the{' '}
        <code>uploads.organization_id</code> FK targets <code>organizations</code>, not the uploader. Every member sees
        and can delete every file.
      </p>
      {uploads.length === 0 ? (
        <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)', fontSize: 13 }}>No files yet.</p>
      ) : (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--color-muted)', fontSize: 13 }}>
          {uploads.map((f) => (
            <li key={f.id} style={{ marginBottom: '0.3rem' }}>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
                {f.filename || f.url}
              </a>{' '}
              <span>({f.mime || 'file'}, {f.size ?? 0} bytes)</span>{' '}
              <button
                type="button"
                onClick={() => onDelete(f.id)}
                style={{
                  marginLeft: 4,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 'var(--radius, 6px)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '0.75rem 0 0', color: 'var(--color-muted)', fontSize: 12 }}>
        Members:{' '}
        {members.map((m, i) => (
          <span key={m.id}>
            {i > 0 ? ', ' : ''}
            <strong style={{ color: 'var(--color-text)' }}>{m.name || m.email}</strong> ({m.role})
          </span>
        ))}
      </p>
    </div>
  )
}

export default function HomePage() {
  const pageContext = usePageContext()
  const { user, org, members, uploads } = useData()
  const signedIn = Boolean(pageContext.user)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Organization-owned files</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        vike-storage is bound to the <code>organizations</code> owner (<code>storageOwner</code>, #250) instead of the
        individual user. An upload belongs to the whole org, so every member shares one file list. The default
        user-owned path is unchanged when <code>storageOwner</code> is omitted.
      </p>

      {!signedIn ? (
        <div style={card}>
          <strong style={{ color: 'var(--color-text)' }}>Not signed in</strong>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
            <a href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</a> to see the organization's shared
            files.
          </p>
        </div>
      ) : (
        <>
          <div style={card}>
            <strong style={{ color: 'var(--color-text)' }}>Signed in</strong>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
              <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>
              {org ? (
                <> — active organization <strong style={{ color: 'var(--color-text)' }}>{org.name}</strong>.</>
              ) : (
                <> — no active organization.</>
              )}
            </p>
          </div>
          {org ? (
            <OrgFiles org={org} members={members} initialUploads={uploads} />
          ) : null}
        </>
      )}

      <p style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.7, marginTop: '1.5rem' }}>
        Seeded sign-ins (magic link printed to the dev console): org owner <code>ada@example.com</code>, member{' '}
        <code>grace@example.com</code> — both in <strong style={{ color: 'var(--color-text)' }}>Acme Corp</strong>. Sign
        in as one, upload a file, then sign in as the other: the file is in the same list, and either can delete it.
      </p>
    </div>
  )
}
