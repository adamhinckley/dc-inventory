import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { NumberInput } from './index'

const meta = {
  title: 'Design System/NumberInput',
  tags: ['autodocs'],
  component: NumberInput,
} satisfies Meta<typeof NumberInput>

export default meta
type Story = StoryObj<typeof meta>

export const Comfortable: Story = {
  render: function ComfortableStory() {
    const [value, setValue] = useState<number | null>(50)
    return (
      <div className="w-48">
        <NumberInput
          value={value}
          onChange={setValue}
          min={0}
          max={9999}
          data-testid="story-number"
        />
      </div>
    )
  },
}

export const Stepper: Story = {
  render: function StepperStory() {
    const [value, setValue] = useState<number | null>(12)
    return (
      <div className="w-48">
        <NumberInput
          stepper
          value={value}
          onChange={setValue}
          min={0}
          max={100}
          step={1}
          data-testid="story-number-stepper"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<number | null>(null)
    return (
      <div className="w-40">
        <NumberInput
          density="compact"
          value={value}
          onChange={setValue}
          placeholder="On hand"
          data-testid="story-number-compact"
        />
      </div>
    )
  },
}
