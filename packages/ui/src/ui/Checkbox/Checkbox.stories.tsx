import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Checkbox } from './index'

const meta = {
  title: 'Design System/Checkbox',
  tags: ['autodocs'],
  component: Checkbox,
  args: {
    'aria-label': 'Include inactive SKUs',
    'data-testid': 'story-checkbox',
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Unchecked: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const Indeterminate: Story = {
  args: { indeterminate: true },
}

export const Compact: Story = {
  args: { density: 'compact', defaultChecked: true },
}

export const Invalid: Story = {
  args: { 'data-invalid': true },
}

export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    return (
      <label className="flex items-center gap-icon text-body">
        <Checkbox
          checked={checked}
          onChange={setChecked}
          data-testid="story-checkbox-controlled"
        />
        Track lot numbers
      </label>
    )
  },
}
