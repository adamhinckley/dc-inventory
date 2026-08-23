import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs } from './index'

const meta = {
  title: 'Design System/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" data-testid="story-tabs">
      <Tabs.List>
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="movements">Movements</Tabs.Trigger>
        <Tabs.Trigger value="purchasing">Purchasing</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="overview">
        <p className="mt-4 text-body">On hand 50 · allocated 2 · available 48.</p>
      </Tabs.Panel>
      <Tabs.Panel value="movements">
        <p className="mt-4 text-body">Receipt, allocation, and adjustment rows.</p>
      </Tabs.Panel>
      <Tabs.Panel value="purchasing">
        <p className="mt-4 text-body">Open PO lines for this SKU.</p>
      </Tabs.Panel>
    </Tabs>
  ),
}
