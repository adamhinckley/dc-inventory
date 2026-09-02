import type { Meta, StoryObj } from '@storybook/react-vite'
import { Breadcrumb } from './index'

const meta = {
  title: 'Design System/Breadcrumb',
  tags: ['autodocs'],
  component: Breadcrumb,
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const ReceivingDocument: Story = {
  render: () => (
    <Breadcrumb data-testid="story-breadcrumb">
      <Breadcrumb.Item href="/receiving">Receiving</Breadcrumb.Item>
      <Breadcrumb.Item current>PO-00016</Breadcrumb.Item>
    </Breadcrumb>
  ),
}
