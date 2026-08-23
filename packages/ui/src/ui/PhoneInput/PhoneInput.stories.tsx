import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { PhoneInput } from './index'

const meta = {
  title: 'Design System/PhoneInput',
  component: PhoneInput,
} satisfies Meta<typeof PhoneInput>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  render: function EmptyStory() {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <PhoneInput
          value={value}
          onChange={setValue}
          placeholder="Phone"
          data-testid="story-phone"
        />
      </div>
    )
  },
}

export const E164: Story = {
  render: function FilledStory() {
    const [value, setValue] = useState('+12565550100')
    return (
      <div className="w-80">
        <PhoneInput value={value} onChange={setValue} data-testid="story-phone-filled" />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState('')
    return (
      <div className="w-72">
        <PhoneInput
          density="compact"
          value={value}
          onChange={setValue}
          data-testid="story-phone-compact"
        />
      </div>
    )
  },
}
