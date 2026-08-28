import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageHeader } from '#ds/ui/PageHeader'
import { Panel } from '#ds/ui/Panel'
import { DashboardLayout } from './index'

const meta = {
  title: 'Design System/DashboardLayout',
  tags: ['autodocs'],
  component: DashboardLayout,
} satisfies Meta<typeof DashboardLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {
  render: () => (
    <div className="-m-8 h-[560px]">
      <DashboardLayout>
        <DashboardLayout.Header>
          <PageHeader data-testid="story-dash-header">
            <PageHeader.HeaderRow>
              <PageHeader.Content>
                <PageHeader.Title>Inventory overview</PageHeader.Title>
              </PageHeader.Content>
            </PageHeader.HeaderRow>
          </PageHeader>
        </DashboardLayout.Header>
        <DashboardLayout.Filters>
          <p className="text-body-sm text-fg-secondary">Warehouse: Huntsville DC</p>
        </DashboardLayout.Filters>
        <DashboardLayout.Grid>
          <DashboardLayout.Row>
            <DashboardLayout.Cell colSpan={6}>
              <Panel data-testid="story-dash-on-hand">
                <Panel.Header>
                  <Panel.Title>
                    <Panel.Title.Text>On hand</Panel.Title.Text>
                  </Panel.Title>
                </Panel.Header>
                <Panel.Body>
                  <p className="section-content-stat-value">12,480</p>
                </Panel.Body>
              </Panel>
            </DashboardLayout.Cell>
            <DashboardLayout.Cell colSpan={6}>
              <Panel variant="secondary" data-testid="story-dash-available">
                <Panel.Header>
                  <Panel.Title>
                    <Panel.Title.Text>Available</Panel.Title.Text>
                  </Panel.Title>
                </Panel.Header>
                <Panel.Body>
                  <p className="section-content-stat-value">11,902</p>
                </Panel.Body>
              </Panel>
            </DashboardLayout.Cell>
          </DashboardLayout.Row>
        </DashboardLayout.Grid>
      </DashboardLayout>
    </div>
  ),
}
