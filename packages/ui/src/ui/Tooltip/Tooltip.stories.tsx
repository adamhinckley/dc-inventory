import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { Tooltip } from './index'

const meta = {
  title: 'Design System/Tooltip',
  component: Tooltip,
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const OnButton: Story = {
  render: () => (
    <Tooltip content="Posts a stock movement; it cannot be edited later.">
      <Button data-testid="story-tooltip-trigger">Adjust on hand</Button>
    </Tooltip>
  ),
}

export const FalsyContent: Story = {
  render: () => (
    <Tooltip content={undefined}>
      <Button data-testid="story-tooltip-passthrough">No tooltip</Button>
    </Tooltip>
  ),
}
