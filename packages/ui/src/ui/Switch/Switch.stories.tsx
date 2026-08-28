import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Switch } from './index'

const meta = {
  title: 'Design System/Switch',
  tags: ['autodocs'],
  component: Switch,
  args: {
    'aria-label': 'Allow backorders',
    'data-testid': 'story-switch',
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {}

export const On: Story = {
  args: { defaultChecked: true },
}

export const Compact: Story = {
  args: { density: 'compact', defaultChecked: true },
}

export const Controlled: Story = {
  render: () => {
    const [on, setOn] = useState(true)
    return (
      <label className="flex items-center gap-icon text-body">
        <Switch checked={on} onChange={setOn} data-testid="story-switch-controlled" />
        Show available only
      </label>
    )
  },
}
