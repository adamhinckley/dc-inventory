import type { Meta, StoryObj } from '@storybook/react-vite'
import { Spinner } from './index'

const meta = {
  title: 'Design System/Spinner',
  tags: ['autodocs'],
  component: Spinner,
  args: {
    label: 'Loading catalog',
    'data-testid': 'story-spinner',
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {}

export const Medium: Story = {
  args: { size: 'md' },
}

export const Large: Story = {
  args: { size: 'lg' },
}
