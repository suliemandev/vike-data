// vike-auth/react's strings — ENGLISH ONLY (the inline default + universal
// fallback). The extension owns its keys (under `auth.*`). This catalog is passed
// INLINE to useTranslation (not contributed to the cumulative `messages`), so the
// UI renders standalone English with no i18n runtime. Other languages are SUBPATHS
// of this package (vike-auth/fr, vike-auth/ar) that DO contribute to `messages`;
// any key a language omits falls back to this English (see vike-i18n's translate +
// the useTranslation fallback). Languages are the translation mirror of the
// framework axis (vike-auth/react), composed the same way.
import { defineMessages } from 'vike-i18n'
// SINGLE SOURCE OF TRUTH for the English `auth.*` strings: the same texts.json this
// package advertises via package.json#exports["texts"] for `vike translate` (#102).
// Importing it here means the inline English the components ship and the catalog the
// translate tool reads can never drift — one file feeds both.
import en from '../texts.json' with { type: 'json' }

export const authMessages = defineMessages({ en })

export default authMessages
