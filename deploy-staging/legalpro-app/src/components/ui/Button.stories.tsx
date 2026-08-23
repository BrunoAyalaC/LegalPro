// legalpro-app/src/components/ui/Button.stories.tsx
// Generado por @frontend + @ux-ui
// Story del componente Button

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    children: { control: 'text' }
  }
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', children: 'Crear demanda' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Cancelar' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Eliminar' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ver más' } };
export const Loading: Story = { args: { isLoading: true, children: 'Guardando...' } };
export const Disabled: Story = { args: { disabled: true, children: 'No disponible' } };
export const Sizes: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button size="sm">Pequeño</Button>
      <Button size="md">Mediano</Button>
      <Button size="lg">Grande</Button>
    </div>
  )
};
