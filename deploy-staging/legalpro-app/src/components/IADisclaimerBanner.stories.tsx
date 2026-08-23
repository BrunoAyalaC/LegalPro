// legalpro-app/src/components/IADisclaimerBanner.stories.tsx
// Generado por @frontend + @ux-ui
// Story del componente IADisclaimerBanner

import type { Meta, StoryObj } from '@storybook/react';
import { IADisclaimerBanner } from './IADisclaimerBanner';

const meta: Meta<typeof IADisclaimerBanner> = {
  title: 'Legal/IADisclaimerBanner',
  component: IADisclaimerBanner,
  tags: ['autodocs']
};
export default meta;
type Story = StoryObj<typeof IADisclaimerBanner>;

export const Default: Story = {};
export const WithConsentInfo: Story = {
  args: {
    toolName: 'Analizar Expediente',
    showConsentInfo: true
  }
};
export const Minimal: Story = {
  args: { variant: 'minimal' }
};
export const WithCTA: Story = {
  args: {
    onAccept: () => console.log('Accepted'),
    ctaText: 'Entendido, continuar'
  }
};
