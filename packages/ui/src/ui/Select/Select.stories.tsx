import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Select } from './index'

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued', disabled: true },
]

const meta = {
  title: 'Design System/Select',
  component: Select,
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {
  render: function ComfortableStory() {
    const [value, setValue] = useState<string | null>('active')
    return (
      <div className="w-72">
        <Select
          options={statusOptions}
          value={value}
          onChange={setValue}
          placeholder="Status"
          data-testid="story-select"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-56">
        <Select
          density="compact"
          options={statusOptions}
          value={value}
          onChange={setValue}
          placeholder="Status"
          data-testid="story-select-compact"
        />
      </div>
    )
  },
}

export const Invalid: Story = {
  render: () => (
    <div className="w-72">
      <Select
        options={statusOptions}
        value={null}
        onChange={() => undefined}
        placeholder="Required"
        data-invalid
        data-testid="story-select-invalid"
      />
    </div>
  ),
}
