import type { Meta, StoryObj } from '@storybook/react-vite'
import { Package, ShoppingCart } from 'lucide-react'
import { Button } from '#ds/ui/Button'
import { AppShell } from './index'

const meta = {
  title: 'Design System/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

export const Dashboard: Story = {
  render: () => (
    <div className="-m-8 h-screen">
      <AppShell
        nav={
          <AppShell.Nav>
            <AppShell.NavGroup id="catalog" label="Catalog" icon={<Package />}>
              <AppShell.NavItem href="/catalog" label="Products" />
              <AppShell.NavItem href="/catalog/categories" label="Categories" />
            </AppShell.NavGroup>
            <AppShell.NavGroup id="sales" label="Sales" icon={<ShoppingCart />}>
              <AppShell.NavItem href="/orders" label="Orders" />
            </AppShell.NavGroup>
          </AppShell.Nav>
        }
        topbar={
          <AppShell.Topbar>
            <AppShell.TopbarActions>
              <Button size="sm" data-testid="story-shell-help">
                Help
              </Button>
            </AppShell.TopbarActions>
          </AppShell.Topbar>
        }
      >
        <div className="p-page-gutter">
          <h1 className="page-title">Products</h1>
          <p className="page-description mt-2">Staff dashboard chrome with sidebar and topbar.</p>
        </div>
      </AppShell>
    </div>
  ),
}
