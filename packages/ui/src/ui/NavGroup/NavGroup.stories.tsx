import type { Meta, StoryObj } from '@storybook/react-vite'
import { Package } from 'lucide-react'
import { NavGroup } from './index'

const meta = {
  title: 'Design System/NavGroup',
  tags: ['autodocs'],
  component: NavGroup,
} satisfies Meta<typeof NavGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Catalog: Story = {
  render: () => (
    <div className="w-64 rounded-section border border-border bg-surface-card p-tight">
      <NavGroup label="Catalog" icon={<Package />}>
        <NavGroup.Item href="/catalog" active>
          Products
        </NavGroup.Item>
        <NavGroup.Item href="/catalog/categories" badge={3}>
          Categories
        </NavGroup.Item>
        <NavGroup.Item href="/purchasing" disabled tooltip="Need purchasing:read">
          Purchasing
        </NavGroup.Item>
      </NavGroup>
    </div>
  ),
}
