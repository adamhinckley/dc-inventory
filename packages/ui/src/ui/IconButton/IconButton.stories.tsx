import type { Meta, StoryObj } from '@storybook/react-vite'
import { EllipsisVertical, Plus, X } from 'lucide-react'
import { IconButton } from './index'

const meta = {
  title: 'Design System/IconButton',
  tags: ['autodocs'],
  component: IconButton,
  args: {
    icon: <Plus />,
    'aria-label': 'Add',
    'data-testid': 'story-icon-button',
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Filled: Story = {}

export const Subtle: Story = {
  args: { variant: 'subtle', icon: <EllipsisVertical />, 'aria-label': 'Actions' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', icon: <X />, 'aria-label': 'Close' },
}

export const ShapesAndSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-region">
      <div className="flex items-center gap-action">
        <IconButton icon={<Plus />} aria-label="Add sm" size="sm" data-testid="story-ib-sm" />
        <IconButton icon={<Plus />} aria-label="Add md" size="md" data-testid="story-ib-md" />
        <IconButton icon={<Plus />} aria-label="Add lg" size="lg" data-testid="story-ib-lg" />
      </div>
      <div className="flex items-center gap-action">
        <IconButton
          icon={<Plus />}
          aria-label="Square"
          shape="square"
          data-testid="story-ib-square"
        />
        <IconButton
          icon={<Plus />}
          aria-label="Circle"
          shape="circle"
          data-testid="story-ib-circle"
        />
      </div>
    </div>
  ),
}

export const DisabledReason: Story = {
  args: {
    disabledReason: 'Missing permission to create a product.',
  },
}
