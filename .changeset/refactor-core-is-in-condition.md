---
'@universal-orm/core': minor
---

@universal-orm/core: export `isInCondition(cond)`, the predicate that distinguishes a membership filter condition (`{ in: [...] }`) from a plain equality value. It was duplicated inline (`cond !== null && typeof cond === 'object' && Array.isArray(cond.in)`) across the in-process matcher and the drizzle/rudder adapters; centralizing it means every adapter agrees on exactly what an `in` condition is and can't drift. The drizzle/rudder adapters and vike-admin's scope-ownership check now use it (no behavior change).
