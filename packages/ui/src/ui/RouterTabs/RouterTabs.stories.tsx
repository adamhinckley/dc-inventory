import type { Meta, StoryObj } from '@storybook/react-vite'
import { RouterTabs } from './index'

const meta = {
  title: 'Design System/RouterTabs',
  tags: ['autodocs'],
  component: RouterTabs,
} satisfies Meta<typeof RouterTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Catalog: Story = {
  render: () => (
    <RouterTabs data-testid="story-router-tabs">
      <RouterTabs.List>
        <RouterTabs.Trigger href="/catalog" exact>
          Products
        </RouterTabs.Trigger>
        <RouterTabs.Trigger href="/catalog/categories">Categories</RouterTabs.Trigger>
        <RouterTabs.Trigger href="/catalog/imports" disabled tooltip="Imports ship in a later slice.">
          Imports
        </RouterTabs.Trigger>
      </RouterTabs.List>
      <RouterTabs.Panel>
        <p className="mt-4 text-body">Active when pathname is /catalog (Storybook mock).</p>
      </RouterTabs.Panel>
    </RouterTabs>
  ),
}
