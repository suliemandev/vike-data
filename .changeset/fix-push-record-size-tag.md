---
'vike-push': patch
---

vike-push: fix an off-by-16 in the aes128gcm single-record size guard. The check capped the plaintext `record` at `RECORD_SIZE` (4096), but the emitted ciphertext is `record.length + 16` (the AES-GCM tag) and RFC 8188 requires the ciphertext record to be `<= rs`. A payload whose record length fell in `(4080, 4096]` passed the check yet produced a ciphertext up to 4112 bytes, over the advertised `rs=4096`, which a conformant push service rejects (and the job then retries to `maxAttempts`). The guard now bounds the plaintext at `RECORD_SIZE - 16`.
