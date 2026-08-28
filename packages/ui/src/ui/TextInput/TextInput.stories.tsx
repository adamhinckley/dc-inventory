import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search } from 'lucide-react'
import { TextInput } from './index'

const meta = {
  title: 'Design System/TextInput',
  component: TextInput,
  tags: ['autodocs'],
  args: {
    placeholder: 'SKU or name',
    'data-testid': 'story-text-input',
  },
  argTypes: {
    label: { control: 'text' },
    helperText: { control: 'text' },
    error: { control: 'text' },
  },
} satisfies Meta<typeof TextInput>

export default meta
type Story = StoryObj<typeof meta>

/** Form-comfortable chrome. The default density next to other labeled fields. */
export const Comfortable: Story = {}

/** Filter-compact chrome for FilterBar and dense toolbars. */
export const Compact: Story = {
  args: { density: 'compact' },
}

/** Leading and trailing adornments share the bordered surface with the input. */
export const WithIcons: Story = {
  args: {
    icon: <Search className="size-icon" />,
    iconTrailing: <kbd className="text-caption text-fg-muted">⌘K</kbd>,
    placeholder: 'Search catalog',
  },
}

/** Label stacked above the control via the `label` prop. */
export const WithLabel: Story = {
  args: { label: 'Product' },
}

/** Helper copy under the control. Hidden when `error` is set. */
export const WithHelperText: Story = {
  args: {
    label: 'Product',
    helperText: 'Search by SKU or display name.',
  },
}

/** Error message plus invalid chrome. Replaces helper text. */
export const Invalid: Story = {
  args: {
    label: 'Product',
    error: 'Enter a SKU or name.',
    defaultValue: '',
  },
}

/** Disabled value. Chrome dims and the input is not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'BOLT-HEX-38' },
}
