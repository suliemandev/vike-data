// vike-storage - the framework-agnostic CLIENT helpers.
//
// The browser half: POST a File to /uploads (multipart, bound to the signed-in user by the
// server endpoint) and DELETE one by id. The React and Vue controls (vike-storage/react,
// vike-storage/vue) are thin wrappers over these.
//
// CLIENT-ONLY: imports nothing from vike-storage's server module (index.js, with node:crypto
// + the ORM adapter), so it is safe in the client bundle. It only touches fetch + FormData.

/**
 * Upload a File (or Blob) to the server. Returns the server's record:
 * `{ ok, id, key, url, filename, mime, size }`. Throws with a clear message if the upload is
 * rejected (e.g. 401 when not signed in).
 */
export async function uploadFile(file, { uploadUrl = '/uploads', fieldName = 'file' } = {}) {
  if (!file) throw new Error('uploadFile: a file is required')
  const form = new FormData()
  form.append(fieldName, file)
  const res = await fetch(uploadUrl, { method: 'POST', body: form, credentials: 'same-origin' })
  if (!res.ok) {
    if (res.status === 401) throw new Error('You must be signed in to upload')
    throw new Error('The upload was rejected by the server')
  }
  return res.json()
}

/**
 * Delete an upload by its row id (the server scopes the delete to the signed-in owner, so
 * this only ever removes the caller's own file). Resolves true on a 2xx response.
 */
export async function deleteUpload(id, { baseUrl = '/uploads' } = {}) {
  const res = await fetch(`${baseUrl}/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
  return res.ok
}
