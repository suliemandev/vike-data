export { config as default }

import type { Config } from '@brillout/docpress'
import React from 'react'
import logo from './assets/logo.svg'
import { headings, headingsDetached } from './headings'
import { ThemeMenu, headHtml } from './ThemeMenu'

const config: Config = {
  name: 'Themed DocPress',
  version: '0.0.0',
  url: 'docpress-themes.example',
  tagline: 'Theming a DocPress site with vike-themes',
  logo,
  favicon: logo,
  navLogoSize: 30,

  github: 'https://github.com/suleimansh/vike-data',

  headings,
  headingsDetached,

  // The proof: a vike-themes-powered theme switcher lives in DocPress's
  // top-navigation React-node slot.
  topNavigation: <ThemeMenu />,
  navMaxWidth: 1140,

  // Inline <head> script that applies the cookie's palette before first paint,
  // so prerendered/static pages don't flash the default theme on load.
  headHtml,
}
