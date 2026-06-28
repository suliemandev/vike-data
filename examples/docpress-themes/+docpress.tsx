export { config as default }

import type { Config } from '@brillout/docpress'
import React from 'react'
import logo from './assets/logo.svg'
import { headings, headingsDetached } from './headings'
import { ThemeMenu } from './ThemeMenu'

const config: Config = {
  name: 'vike-themes × DocPress',
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
}
