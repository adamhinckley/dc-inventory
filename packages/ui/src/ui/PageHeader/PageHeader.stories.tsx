import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { PageHeader } from './index'

const meta = {
  title: 'Design System/PageHeader',
  tags: ['autodocs'],
  component: PageHeader,
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Catalog: Story = {
  render: () => (
    <PageHeader data-testid="story-page-header">
      <PageHeader.HeaderRow>
        <PageHeader.Content>
          <PageHeader.Title>Products</PageHeader.Title>
          <PageHeader.Subtitle>Wholesale catalog and on-hand quantities.</PageHeader.Subtitle>
        </PageHeader.Content>
        <PageHeader.Actions>
          <Button data-testid="story-page-header-secondary">Import</Button>
          <Button variant="primary" data-testid="story-page-header-primary">
            New product
          </Button>
        </PageHeader.Actions>
      </PageHeader.HeaderRow>
    </PageHeader>
  ),
}

export const Pending: Story = {
  render: () => (
    <PageHeader data-testid="story-page-header-pending">
      <PageHeader.HeaderRow>
        <PageHeader.Content>
          <PageHeader.Title isPending>Product</PageHeader.Title>
          <PageHeader.Subtitle isPending>SKU</PageHeader.Subtitle>
        </PageHeader.Content>
      </PageHeader.HeaderRow>
    </PageHeader>
  ),
}
