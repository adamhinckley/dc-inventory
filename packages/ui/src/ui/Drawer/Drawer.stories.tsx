import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { Drawer } from './index'

const meta = {
  title: 'Design System/Drawer',
  tags: ['autodocs'],
  component: Drawer,
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

export const Right: Story = {
  render: () => (
    <Drawer>
      <Drawer.Trigger
        className="interactable inline-flex h-8 items-center rounded-interactable border border-border px-button-x text-button"
        data-testid="story-drawer-trigger"
      >
        Filters
      </Drawer.Trigger>
      <Drawer.Content side="right" size="md" data-testid="story-drawer">
        <Drawer.Header>
          <Drawer.Title>Catalog filters</Drawer.Title>
          <Drawer.Description>Applies to the current explorer list.</Drawer.Description>
        </Drawer.Header>
        <Drawer.Body>
          <p className="text-body">Status, warehouse, and received date live here.</p>
        </Drawer.Body>
        <Drawer.Footer>
          <Button data-testid="story-drawer-reset">Reset</Button>
          <Button variant="primary" data-testid="story-drawer-apply">
            Apply
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  ),
}

export const Left: Story = {
  render: () => (
    <Drawer>
      <Drawer.Trigger
        className="interactable inline-flex h-8 items-center rounded-interactable border border-border px-button-x text-button"
        data-testid="story-drawer-left-trigger"
      >
        Open left
      </Drawer.Trigger>
      <Drawer.Content side="left" size="sm" data-testid="story-drawer-left">
        <Drawer.Header>
          <Drawer.Title>Quick nav</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          <p className="text-body">Jump to a warehouse aisle.</p>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  ),
}
