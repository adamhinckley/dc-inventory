import type { Meta, StoryObj } from '@storybook/react-vite'
import { TooltipHelp } from './index'

const meta = {
  title: 'Design System/TooltipHelp',
  component: TooltipHelp,
  args: {
    title: 'Available',
    description: 'on_hand minus allocated. Inventory writes this via movements only.',
    'data-testid': 'story-tooltip-help',
  },
} satisfies Meta<typeof TooltipHelp>

export default meta
type Story = StoryObj<typeof meta>

export const HelpIcon: Story = {}

export const DescriptionOnly: Story = {
  args: { title: undefined, description: 'SKU must be unique per tenant.' },
}
