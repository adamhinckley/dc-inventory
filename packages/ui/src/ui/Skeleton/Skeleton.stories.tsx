import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './index'

const meta = {
  title: 'Design System/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Line: Story = {
  args: { className: 'h-4 w-48' },
}

export const Block: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-field">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  ),
}
