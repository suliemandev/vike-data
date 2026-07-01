// Row projection now lives in vike-view's framework-agnostic core (the shared allow-list
// that decides which columns of a row leave the server, #228); vike-admin consumes it.
// Re-exported here so the admin's own modules and tests keep importing `./project.js`.
export * from 'vike-view/project'
