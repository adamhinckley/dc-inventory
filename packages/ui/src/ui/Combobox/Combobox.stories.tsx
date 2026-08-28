import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Combobox } from './index'

const warehouseOptions = [
  { value: 'hsv', label: 'Huntsville DC' },
  { value: 'atl', label: 'Atlanta DC' },
  { value: 'dal', label: 'Dallas DC' },
  { value: 'sea', label: 'Seattle DC' },
]

const meta = {
  title: 'Design System/Combobox',
  tags: ['autodocs'],
  component: Combobox,
  argTypes: {
    helperText: { control: 'text' },
  },
} satisfies Meta<typeof Combobox>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: function SingleStory() {
    const [value, setValue] = useState<string | null>('hsv')
    return (
      <div className="w-80">
        <Combobox
          options={warehouseOptions}
          value={value}
          onChange={setValue}
          placeholder="Warehouse"
          clearable
          data-testid="story-combobox"
        />
      </div>
    )
  },
}

export const WithHelperText: Story = {
  args: {
    helperText: 'Ships to this warehouse.',
  },
  render: function WithHelperTextStory({ helperText }) {
    const [value, setValue] = useState<string | null>('hsv')
    return (
      <div className="w-80">
        <Combobox
          options={warehouseOptions}
          value={value}
          onChange={setValue}
          placeholder="Warehouse"
          clearable
          helperText={helperText}
          data-testid="story-combobox-helper"
        />
      </div>
    )
  },
}

export const Multi: Story = {
  render: function MultiStory() {
    const [value, setValue] = useState<string[]>(['hsv'])
    return (
      <div className="w-80">
        <Combobox
          multiple
          options={warehouseOptions}
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
          placeholder="Warehouses"
          data-testid="story-combobox-multi"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-64">
        <Combobox
          density="compact"
          options={warehouseOptions}
          value={value}
          onChange={setValue}
          placeholder="Filter warehouse"
          data-testid="story-combobox-compact"
        />
      </div>
    )
  },
}
