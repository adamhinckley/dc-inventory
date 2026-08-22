import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { NumberRangeInput, type NumberRangeValue } from './index'

const meta = {
  title: 'Design System/NumberRangeInput',
  component: NumberRangeInput,
} satisfies Meta<typeof NumberRangeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {
  render: function ComfortableStory() {
    const [value, setValue] = useState<NumberRangeValue>({ min: 0, max: 100 })
    return (
      <div className="w-80">
        <NumberRangeInput
          value={value}
          onChange={setValue}
          min={0}
          max={10000}
          data-testid="story-number-range"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<NumberRangeValue>({})
    return (
      <div className="w-72">
        <NumberRangeInput
          density="compact"
          value={value}
          onChange={setValue}
          minPlaceholder="Min available"
          maxPlaceholder="Max available"
          data-testid="story-number-range-compact"
        />
      </div>
    )
  },
}
