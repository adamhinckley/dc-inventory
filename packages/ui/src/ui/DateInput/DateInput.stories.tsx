import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { DateInput } from './index'

const meta = {
  title: 'Design System/DateInput',
  tags: ['autodocs'],
  component: DateInput,
} satisfies Meta<typeof DateInput>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {
  render: function ComfortableStory() {
    const [value, setValue] = useState<string | null>('2026-03-20')
    return (
      <div className="w-72">
        <DateInput value={value} onChange={setValue} data-testid="story-date" />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-56">
        <DateInput
          density="compact"
          value={value}
          onChange={setValue}
          placeholder="Received"
          data-testid="story-date-compact"
        />
      </div>
    )
  },
}

export const YearNavigation: Story = {
  render: function YearNavStory() {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-72">
        <DateInput
          value={value}
          onChange={setValue}
          yearNavigation
          min="1950-01-01"
          max="2026-12-31"
          placeholder="Birth date"
          data-testid="story-date-year"
        />
      </div>
    )
  },
}

export const YearNavigationDefaultMax: Story = {
  render: function YearNavDefaultMaxStory() {
    const [value, setValue] = useState<string | null>(null)
    const farYear = new Date().getFullYear() + 10
    return (
      <div className="w-72 space-y-2">
        <p className="text-body-sm text-fg-secondary">
          No explicit max — year dropdown runs through {farYear}.
        </p>
        <DateInput
          value={value}
          onChange={setValue}
          yearNavigation
          placeholder="Close date"
          data-testid="story-date-year-default-max"
        />
      </div>
    )
  },
}
