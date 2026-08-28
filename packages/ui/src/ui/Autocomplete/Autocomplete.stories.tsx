import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Autocomplete } from './index'

const skuOptions = [
  { value: 'bolt', label: 'BOLT-HEX-38' },
  { value: 'wash', label: 'WASH-SS-10' },
  { value: 'nut', label: 'NUT-NYL-06' },
]

const meta = {
  title: 'Design System/Autocomplete',
  tags: ['autodocs'],
  component: Autocomplete,
} satisfies Meta<typeof Autocomplete>

export default meta
type Story = StoryObj<typeof meta>

export const WithSuggestions: Story = {
  render: function WithSuggestionsStory() {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <Autocomplete
          options={skuOptions}
          value={value}
          onChange={setValue}
          placeholder="Type a SKU"
          clearable
          data-testid="story-autocomplete"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState('BOLT')
    return (
      <div className="w-64">
        <Autocomplete
          density="compact"
          options={skuOptions}
          value={value}
          onChange={setValue}
          placeholder="SKU"
          data-testid="story-autocomplete-compact"
        />
      </div>
    )
  },
}
