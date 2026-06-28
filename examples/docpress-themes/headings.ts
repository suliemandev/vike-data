export { headings }
export { headingsDetached }

import type { HeadingDefinition, HeadingDetachedDefinition } from '@brillout/docpress'

// Two categories on purpose. DocPress only auto-expands a top-nav category when
// the menu lays out in more than one column (maxColumns > 1, see
// NavigationWithColumnLayout). A single-category site stays in one column, so on
// the landing page (where no item is the "current" one) the lone category renders
// collapsed and the Docs dropdown looks empty. Splitting the pages across two
// categories - like vike.dev - keeps the dropdown expanded everywhere, including /.
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
    level: 1,
    title: 'Theming',
    color: '#db2777',
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
