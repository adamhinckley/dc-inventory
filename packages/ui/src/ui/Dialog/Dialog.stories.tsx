import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { Dialog } from './index'

const meta = {
  title: 'Design System/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Confirm: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger
        render={
          <Button variant="primary" data-testid="story-dialog-trigger">
            Receive shipment
          </Button>
        }
        data-testid="story-dialog-trigger-slot"
      />
      <Dialog.Content size="sm" data-testid="story-dialog">
        <Dialog.Header>
          <Dialog.Title>Receive PO-1042</Dialog.Title>
          <Dialog.Description>
            This posts on-hand for every line still outstanding.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-body">3 lines, 162 units. This cannot be undone from the list.</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button data-testid="story-dialog-cancel">Cancel</Button>} />
          <Button variant="primary" data-testid="story-dialog-confirm">
            Receive
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
}

export const Large: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger
        render={<Button data-testid="story-dialog-lg-trigger">Open large</Button>}
      />
      <Dialog.Content size="lg" data-testid="story-dialog-lg">
        <Dialog.Header>
          <Dialog.Title>Import products</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-body">CSV columns: sku, name, on_hand, status.</p>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  ),
}
