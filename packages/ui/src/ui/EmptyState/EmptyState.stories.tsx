import type { Meta, StoryObj } from '@storybook/react-vite'
import { PackageOpen } from 'lucide-react'
import { Button } from '#ds/ui/Button'
import { EmptyState } from './index'

const meta = {
  title: 'Design System/EmptyState',
  component: EmptyState,
  args: {
    icon: <PackageOpen />,
    title: 'No products yet',
    message: 'Create a SKU or import a catalog to populate this list.',
    'data-testid': 'story-empty-state',
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Vertical: Story = {
  args: {
    action: (
      <Button variant="primary" data-testid="story-empty-cta">
        New product
      </Button>
    ),
  },
}

export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
    title: 'No rows match these filters',
    message: 'Clear status or search to see the full catalog.',
  },
}
