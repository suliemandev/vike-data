// Arabic catalog for vike-auth's `auth.*` keys. Framework-agnostic message DATA.
// A full set (including the account.* keys the French pack omits), so it doubles as
// our RTL data point: the strings are here; mapping locale -> layout direction is a
// follow-up (#54). Reviewed by a native speaker (the keys, not the wiring).
import { defineMessages } from 'vike-i18n'

export const authMessagesAr = defineMessages({
  ar: {
    'auth.signIn': 'تسجيل الدخول إلى {app}',
    'auth.subtitle': 'بدون كلمة مرور. نرسل إليك رابطًا لمرة واحدة عبر البريد الإلكتروني.',
    'auth.email': 'البريد الإلكتروني',
    'auth.send': 'إرسال رابط الدخول',
    'auth.sending': 'جارٍ الإرسال...',
    'auth.inboxTitle': 'تحقق من بريدك الوارد',
    'auth.inboxBody': 'أرسلنا رابط تسجيل الدخول إلى {email}.',
    'auth.devNote': 'في وضع التطوير لا يُرسَل أي بريد إلكتروني. يُطبع رابط الدخول في وحدة تحكم الخادم.',
    'auth.different': 'استخدام بريد إلكتروني آخر',
    'auth.error': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    'auth.footer': 'مُقدَّم من إضافة vike-auth.',
    'auth.signInShort': 'تسجيل الدخول',
    'auth.logout': 'تسجيل الخروج',
    'auth.accountTitle': 'حسابك',
    'auth.accountSignedInAs': 'مُسجَّل الدخول باسم',
    'auth.accountName': 'الاسم',
    'auth.accountSignedOut': 'لم تقم بتسجيل الدخول.',
  },
})

export default authMessagesAr
