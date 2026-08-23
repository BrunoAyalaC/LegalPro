// legalpro-app/.storybook/main.ts
// Generado por @frontend + @ux-ui
// Storybook config para documentar 35+ componentes

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(js|jsx|ts|tsx)',
    '../src/pages/**/*.stories.@(js|jsx|ts|tsx)'
  ],
  addons: [
    '@storybook/addon-essentials',
    '@axe-core/storybook-axe',
    '@storybook/addon-a11y'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  },
  features: {
    a11y: true,
    visualTests: true
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript'
  }
};
export default config;
