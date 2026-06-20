// Re-export of the framework-agnostic schema core, so extension authors that
// already depend on vike-schema get the DSL (defineSchema/extendSchema), the
// merge/derive helpers, and the per-ORM compilers from a single package via
// `@vike-data/vike-schema/schema` — without taking a second dependency on
// `@vike-data/universal-schema` directly.
export * from '@vike-data/universal-schema'
