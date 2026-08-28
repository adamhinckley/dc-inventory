import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { PageHeader } from '#ds/ui/PageHeader'
import { ExplorerView } from './index'

const meta = {
  title: 'Design System/ExplorerView',
  tags: ['autodocs'],
  component: ExplorerView,
} satisfies Meta<typeof ExplorerView>

export default meta
type Story = StoryObj<typeof meta>

export const Catalog: Story = {
  render: () => (
    <div className="-m-8 h-[560px]">
      <ExplorerView>
        <ExplorerView.Header>
          <PageHeader data-testid="story-explorer-header">
            <PageHeader.HeaderRow>
              <PageHeader.Content>
                <PageHeader.Title>Products</PageHeader.Title>
                <PageHeader.Subtitle>Search and filter the wholesale catalog.</PageHeader.Subtitle>
              </PageHeader.Content>
              <PageHeader.Actions>
                <ExplorerView.CreateButton data-testid="story-explorer-create" />
              </PageHeader.Actions>
            </PageHeader.HeaderRow>
          </PageHeader>
        </ExplorerView.Header>
        <ExplorerView.Content>
          <div className="rounded-section border border-border bg-surface-card p-card">
            <p className="text-body">Table slot — SKU list would live here.</p>
          </div>
        </ExplorerView.Content>
        <ExplorerView.CreateDialog title="New product" data-testid="story-explorer-dialog">
          <p className="text-body">Create form fields go in this dialog body.</p>
          <Button className="mt-4" variant="primary" data-testid="story-explorer-save">
            Save
          </Button>
        </ExplorerView.CreateDialog>
      </ExplorerView>
    </div>
  ),
}
