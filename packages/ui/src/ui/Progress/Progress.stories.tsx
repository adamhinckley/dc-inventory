import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress } from './index'

const meta = {
  title: 'Design System/Progress',
  tags: ['autodocs'],
  component: Progress,
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const Indeterminate: Story = {
  render: () => (
    <div className="w-80">
      <Progress />
    </div>
  ),
}

export const Determinate: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-field">
      <Progress value={25} />
      <Progress value={60} />
      <Progress value={100} />
    </div>
  ),
}
