// Shared, framework-agnostic style data for the `button` block, imported by BOTH the react and vue
// renderers so the shadcn Base surface can't drift between them. Theme-native: every color is a
// vike-themes CSS var (with a fallback). The variant set mirrors shadcn Base
// (default / secondary / outline / ghost / link / destructive) and the size set its sm / default /
// lg / icon. Our historical names alias onto it, so old configs still render:
//   variant primary -> default, danger -> destructive; size md -> default.
//
// :hover / :focus-visible / disabled can't be expressed as inline styles, so the element carries a
// `vike-blocks-btn` class + a per-instance `--btn-bg-hover` custom prop, and BUTTON_STYLE_TAG (a
// static, identical-everywhere <style>) wires the states to it — dep-free, SSR-safe.
export const VARIANT_ALIAS = { primary: 'default', danger: 'destructive' }
export const SIZE_ALIAS = { md: 'default' }

export const VARIANTS = {
  default: { bg: 'var(--color-primary, #2563eb)', fg: 'var(--color-primary-text, #ffffff)', border: 'transparent', hover: 'color-mix(in srgb, var(--color-primary, #2563eb) 90%, #000)' },
  secondary: { bg: 'var(--color-surface, #f1f5f9)', fg: 'var(--color-text, #0f172a)', border: 'transparent', hover: 'color-mix(in srgb, var(--color-surface, #f1f5f9) 90%, var(--color-text, #0f172a))' },
  outline: { bg: 'var(--color-bg, #ffffff)', fg: 'var(--color-text, #0f172a)', border: 'var(--color-border, #e2e8f0)', hover: 'var(--color-surface, #f1f5f9)' },
  ghost: { bg: 'transparent', fg: 'var(--color-text, #0f172a)', border: 'transparent', hover: 'var(--color-surface, #f1f5f9)' },
  link: { bg: 'transparent', fg: 'var(--color-primary, #2563eb)', border: 'transparent', hover: 'transparent' },
  destructive: { bg: 'var(--color-danger, #dc2626)', fg: '#ffffff', border: 'transparent', hover: 'color-mix(in srgb, var(--color-danger, #dc2626) 90%, #000)' },
}

export const SIZES = {
  sm: { height: '2rem', padding: '0 0.75rem', fontSize: '13px' },
  default: { height: '2.25rem', padding: '0 1rem', fontSize: '14px' },
  lg: { height: '2.5rem', padding: '0 1.5rem', fontSize: '14px' },
  icon: { height: '2.25rem', width: '2.25rem', padding: '0', fontSize: '14px' },
}

// Normalize a (possibly historical) variant/size name to its canonical key.
export const variantKey = (v) => VARIANT_ALIAS[v] ?? v ?? 'default'
export const sizeKey = (s) => SIZE_ALIAS[s] ?? s ?? 'default'
const resolveVariant = (v) => VARIANTS[variantKey(v)] ?? VARIANTS.default
const resolveSize = (s) => SIZES[sizeKey(s)] ?? SIZES.default

// The inline style for the button element. Base layout + the variant's colors; the hover color
// rides a `--btn-bg-hover` custom prop that BUTTON_STYLE_TAG's `:hover` rule reads.
export function buttonStyle(variant, size, disabled) {
  const v = resolveVariant(variant)
  const s = resolveSize(size)
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
    height: s.height,
    ...(s.width ? { width: s.width } : {}),
    padding: s.padding,
    fontSize: s.fontSize,
    fontWeight: 500,
    fontFamily: 'inherit',
    lineHeight: 1,
    borderRadius: 'var(--radius, 8px)',
    border: `1px solid ${v.border}`,
    background: v.bg,
    color: v.fg,
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    '--btn-bg-hover': v.hover,
  }
}

// The static <style> that gives the button its interactive states (identical for every button, so
// duplicate tags collapse to one effect). A `link` button underlines on hover instead of tinting.
export const BUTTON_STYLE_TAG =
  '.vike-blocks-btn{transition:background-color .15s ease,box-shadow .15s ease,color .15s ease}' +
  '.vike-blocks-btn:hover{background:var(--btn-bg-hover)}' +
  '.vike-blocks-btn[data-variant="link"]:hover{text-decoration:underline}' +
  '.vike-blocks-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--color-bg,#fff),0 0 0 4px var(--color-ring,var(--color-primary,#2563eb))}' +
  '.vike-blocks-btn:disabled,.vike-blocks-btn[aria-disabled="true"]{opacity:.5;pointer-events:none}'
