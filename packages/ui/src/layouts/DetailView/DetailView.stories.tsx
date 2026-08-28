import type { Meta, StoryObj } from '@storybook/react-vite'
import { DescriptionList } from '#ds/ui/DescriptionList'
import { PageHeader } from '#ds/ui/PageHeader'
import { Tabs } from '#ds/ui/Tabs'
import { DetailView } from './index'

const meta = {
  title: 'Design System/DetailView',
  tags: ['autodocs'],
  component: DetailView,
} satisfies Meta<typeof DetailView>

export default meta
type Story = StoryObj<typeof meta>

export const Product: Story = {
  render: () => (
    <div className="-m-8 h-[640px]">
      <DetailView>
        <DetailView.Header>
          <PageHeader data-testid="story-detail-header">
            <PageHeader.HeaderRow>
              <PageHeader.Content>
                <PageHeader.Title>Galvanized hex bolt</PageHeader.Title>
                <PageHeader.Subtitle>BOLT-HEX-38</PageHeader.Subtitle>
              </PageHeader.Content>
              <PageHeader.Actions>
                <DetailView.EditButton data-testid="story-detail-edit" />
              </PageHeader.Actions>
            </PageHeader.HeaderRow>
          </PageHeader>
        </DetailView.Header>
        <DetailView.Summary>
          <DescriptionList data-testid="story-detail-summary">
            <DescriptionList.Heading>Inventory</DescriptionList.Heading>
            <DescriptionList.Item>
              <DescriptionList.Term>On hand</DescriptionList.Term>
              <DescriptionList.Data>50</DescriptionList.Data>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Available</DescriptionList.Term>
              <DescriptionList.Data>48</DescriptionList.Data>
            </DescriptionList.Item>
          </DescriptionList>
        </DetailView.Summary>
        <DetailView.Tabs>
          <Tabs defaultValue="movements" data-testid="story-detail-tabs">
            <Tabs.List>
              <Tabs.Trigger value="movements">Movements</Tabs.Trigger>
              <Tabs.Trigger value="purchasing">Purchasing</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Panel value="movements">
              <p className="mt-4 text-body">Receipt and allocation history.</p>
            </Tabs.Panel>
            <Tabs.Panel value="purchasing">
              <p className="mt-4 text-body">Open purchase order lines.</p>
            </Tabs.Panel>
          </Tabs>
        </DetailView.Tabs>
        <DetailView.EditDialog title="Edit product" data-testid="story-detail-dialog">
          <p className="text-body">Edit form fields go here.</p>
        </DetailView.EditDialog>
      </DetailView>
    </div>
  ),
}
