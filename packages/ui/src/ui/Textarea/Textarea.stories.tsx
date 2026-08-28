import type { Meta, StoryObj } from '@storybook/react-vite'
import { Textarea } from './index'

const meta = {
  title: 'Design System/Textarea',
  tags: ['autodocs'],
  component: Textarea,
  args: {
    placeholder: 'Receiving notes',
    rows: 4,
    'data-testid': 'story-textarea',
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {}

export const Compact: Story = {
  args: { density: 'compact' },
}

export const Invalid: Story = {
  args: { 'data-invalid': true },
}

export const ResizeNone: Story = {
  args: { resize: 'none', defaultValue: 'Fixed height notes field.' },
}
