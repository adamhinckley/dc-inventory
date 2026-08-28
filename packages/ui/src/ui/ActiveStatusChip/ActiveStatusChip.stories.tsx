import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActiveStatusChip } from './index'

const meta = {
  title: 'Design System/ActiveStatusChip',
  tags: ['autodocs'],
  component: ActiveStatusChip,
  args: {
    active: true,
    'data-testid': 'story-active-status',
  },
} satisfies Meta<typeof ActiveStatusChip>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}

export const Inactive: Story = {
  args: { active: false },
}

export const Pair: Story = {
  render: () => (
    <div className="flex gap-icon">
      <ActiveStatusChip active data-testid="story-active" />
      <ActiveStatusChip active={false} data-testid="story-inactive" />
    </div>
  ),
}
