import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search } from 'lucide-react'
import { TextInput } from './index'

const meta = {
  title: 'Design System/TextInput',
  component: TextInput,
  args: {
    placeholder: 'SKU or name',
    'data-testid': 'story-text-input',
  },
} satisfies Meta<typeof TextInput>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {}

export const Compact: Story = {
  args: { density: 'compact' },
}

export const WithIcons: Story = {
  args: {
    icon: <Search className="size-icon" />,
    iconTrailing: <kbd className="text-caption text-fg-muted">⌘K</kbd>,
    placeholder: 'Search catalog',
  },
}

export const Invalid: Story = {
  args: { 'data-invalid': true, defaultValue: '' },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'BOLT-HEX-38' },
}
