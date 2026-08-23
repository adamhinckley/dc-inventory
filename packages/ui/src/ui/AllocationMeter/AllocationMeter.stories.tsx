import type { Meta, StoryObj } from '@storybook/react-vite'
import { AllocationMeter } from './index'

const meta = {
  title: 'Design System/AllocationMeter',
  component: AllocationMeter,
  args: {
    max: 100,
    value: 42,
    className: 'w-64',
    'aria-hidden': true,
  },
} satisfies Meta<typeof AllocationMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Committed: Story = {}

export const WithPendingIncrease: Story = {
  args: { pending: 18 },
}

export const NearlyFull: Story = {
  args: { value: 92, pending: 6 },
}
