---
'vike-queue': patch
'vike-mail': patch
---

Harden vike-queue and vike-mail after review.

- vike-queue: the database driver compares `run_at` with `Date.parse` instead of lexical string order, so a custom `now` format cannot silently break which jobs are ready. Clarified that `work({ max })` is a processing cap, not a fetch cap.
- vike-mail: the dev transport JSON-stringifies the recipient in its log line (no log injection via a newline in `to`), and the `vike-mail:send` job re-registers itself on demand so clearing the queue's job registry cannot permanently break sending.
