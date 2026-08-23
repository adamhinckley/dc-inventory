import type { Meta, StoryObj } from '@storybook/react-vite'
import { Popover } from './index'

const meta = {
  title: 'Design System/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Popover>
      <Popover.Trigger
        className="interactable inline-flex h-8 items-center rounded-interactable border border-border px-button-x text-button"
        data-testid="story-popover-trigger"
      >
        Columns
      </Popover.Trigger>
      <Popover.Content data-testid="story-popover">
        <p className="overlay-title">Visible columns</p>
        <p className="overlay-description mt-1">SKU, name, on hand, available.</p>
      </Popover.Content>
    </Popover>
  ),
}
