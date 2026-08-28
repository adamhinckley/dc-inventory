import type { Meta, StoryObj } from '@storybook/react-vite'
import { Menu } from './index'

const meta = {
  title: 'Design System/Menu',
  tags: ['autodocs'],
  component: Menu,
} satisfies Meta<typeof Menu>

export default meta
type Story = StoryObj<typeof meta>

export const RowActions: Story = {
  render: () => (
    <Menu>
      <Menu.Trigger
        className="interactable inline-flex h-8 items-center rounded-interactable border border-border px-button-x text-button"
        data-testid="story-menu-trigger"
      >
        Actions
      </Menu.Trigger>
      <Menu.Content data-testid="story-menu">
        <Menu.Group>
          <Menu.GroupLabel>Product</Menu.GroupLabel>
          <Menu.Item onClick={() => undefined}>Edit</Menu.Item>
          <Menu.Item onClick={() => undefined}>Duplicate</Menu.Item>
        </Menu.Group>
        <Menu.Separator />
        <Menu.Item onClick={() => undefined} disabled>
          Archive (need write)
        </Menu.Item>
      </Menu.Content>
    </Menu>
  ),
}

export const WithButtonTrigger: Story = {
  render: () => (
    <Menu>
      <Menu.Trigger data-testid="story-menu-btn-trigger">
        <span className="text-button">Open</span>
      </Menu.Trigger>
      <Menu.Content align="end" data-testid="story-menu-btn">
        <Menu.Item onClick={() => undefined}>Print pick list</Menu.Item>
        <Menu.Item onClick={() => undefined}>Export CSV</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
}
