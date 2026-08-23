import type { Meta, StoryObj } from '@storybook/react-vite'
import { Timestamp } from './index'

const meta = {
  title: 'Design System/Timestamp',
  component: Timestamp,
  args: {
    value: '2026-03-20T10:00:00.000Z',
    'data-testid': 'story-timestamp',
  },
} satisfies Meta<typeof Timestamp>

export default meta
type Story = StoryObj<typeof meta>

export const Long: Story = {}

export const Short: Story = {
  args: { format: 'short' },
}

export const WithTime: Story = {
  args: { withTime: true },
}
