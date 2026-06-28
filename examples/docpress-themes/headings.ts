export { headings }
export { headingsDetached }

import type { HeadingDefinition, HeadingDetachedDefinition } from '@brillout/docpress'

const headings: HeadingDefinition[] = [
  {
    level: 1,
    title: 'Overview',
    color: '#4f46e5',
  },
  {
    level: 2,
    title: 'Introduction',
    titleDocument: 'vike-themes × DocPress',
    url: '/',
  },
  {
    level: 2,
    title: 'How theming works',
    url: '/theming',
  },
  {
    level: 2,
    title: 'Coverage & caveats',
    url: '/coverage',
  },
]

const headingsDetached: HeadingDetachedDefinition[] = []
