import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { DateRangeInput, type DateRangeValue } from './index'

const meta = {
  title: 'Design System/DateRangeInput',
  tags: ['autodocs'],
  component: DateRangeInput,
} satisfies Meta<typeof DateRangeInput>

export default meta
type Story = StoryObj<typeof meta>

export const AbsoluteRange: Story = {
  render: function AbsoluteStory() {
    const [value, setValue] = useState<DateRangeValue>({
      from: '2026-03-01',
      to: '2026-03-20',
    })
    return (
      <div className="w-80">
        <DateRangeInput value={value} onChange={setValue} data-testid="story-date-range" />
      </div>
    )
  },
}

export const LastSevenDays: Story = {
  render: function RelativeStory() {
    const [value, setValue] = useState<DateRangeValue>({ from: '-P7D' })
    return (
      <div className="w-80">
        <DateRangeInput value={value} onChange={setValue} data-testid="story-date-range-rel" />
      </div>
    )
  },
}

export const CompactNoHint: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<DateRangeValue>({})
    return (
      <div className="w-64">
        <DateRangeInput
          density="compact"
          showHint={false}
          value={value}
          onChange={setValue}
          placeholder="Received range"
          data-testid="story-date-range-compact"
        />
      </div>
    )
  },
}
