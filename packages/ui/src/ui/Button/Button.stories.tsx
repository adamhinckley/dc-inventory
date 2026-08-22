import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './index'

const meta = {
  title: 'Design System/Button',
  component: Button,
  args: {
    children: 'Save',
    'data-testid': 'story-button',
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Primary: Story = {
  args: { variant: 'primary' },
}

export const Secondary: Story = {
  args: { variant: 'secondary' },
}

export const Ghost: Story = {
  args: { variant: 'ghost' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-action">
      <Button size="xs" data-testid="story-button-xs">
        Extra small
      </Button>
      <Button size="sm" data-testid="story-button-sm">
        Small
      </Button>
      <Button size="md" data-testid="story-button-md">
        Medium
      </Button>
      <Button size="lg" data-testid="story-button-lg">
        Large
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const DisabledReason: Story = {
  args: {
    disabledReason: 'You need catalog:write to save products.',
  },
}
