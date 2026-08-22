import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from './index'

const meta = {
  title: 'Design System/Calendar',
  component: Calendar,
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: function SingleStory() {
    const [value, setValue] = useState<Date | null>(new Date(2026, 2, 20))
    return <Calendar mode="single" value={value} onChange={setValue} />
  },
}

export const Range: Story = {
  render: function RangeStory() {
    const [value, setValue] = useState<DateRange | undefined>({
      from: new Date(2026, 2, 1),
      to: new Date(2026, 2, 20),
    })
    return (
      <Calendar mode="range" numberOfMonths={2} value={value} onChange={setValue} />
    )
  },
}
