import type { Meta, StoryObj } from '@storybook/react-vite'
import { DescriptionList } from './index'

const meta = {
  title: 'Design System/DescriptionList',
  component: DescriptionList,
} satisfies Meta<typeof DescriptionList>

export default meta
type Story = StoryObj<typeof meta>

export const Product: Story = {
  render: () => (
    <DescriptionList data-testid="story-dl">
      <DescriptionList.Heading>Product</DescriptionList.Heading>
      <DescriptionList.Item>
        <DescriptionList.Term>SKU</DescriptionList.Term>
        <DescriptionList.Data>BOLT-HEX-38</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Data>Galvanized hex bolt</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>On hand</DescriptionList.Term>
        <DescriptionList.Data>50</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Available</DescriptionList.Term>
        <DescriptionList.Data>48</DescriptionList.Data>
      </DescriptionList.Item>
    </DescriptionList>
  ),
}

export const Secondary: Story = {
  render: () => (
    <DescriptionList variant="secondary" maxColumns={2} data-testid="story-dl-secondary">
      <DescriptionList.Heading>Warehouse</DescriptionList.Heading>
      <DescriptionList.Item>
        <DescriptionList.Term>Code</DescriptionList.Term>
        <DescriptionList.Data>HSV</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Data>Huntsville DC</DescriptionList.Data>
      </DescriptionList.Item>
    </DescriptionList>
  ),
}
