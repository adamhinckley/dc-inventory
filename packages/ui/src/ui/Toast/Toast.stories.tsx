import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { Toast, useToast } from './index'

function ToastDemo() {
  const { toast } = useToast()
  return (
    <div className="flex flex-wrap gap-action">
      <Button
        data-testid="story-toast-success"
        onClick={() =>
          toast({ intent: 'success', title: 'Received PO-1042', testid: 'toast-success' })
        }
      >
        Success
      </Button>
      <Button
        data-testid="story-toast-error"
        onClick={() =>
          toast({
            intent: 'error',
            title: 'Allocate failed',
            description: 'Not enough available for BOLT-HEX-38.',
            testid: 'toast-error',
          })
        }
      >
        Error
      </Button>
      <Button
        data-testid="story-toast-warning"
        onClick={() =>
          toast({ intent: 'warning', title: 'Low stock on WASH-SS-10', testid: 'toast-warn' })
        }
      >
        Warning
      </Button>
      <Button
        data-testid="story-toast-info"
        onClick={() =>
          toast({
            intent: 'info',
            title: 'Copied SKU',
            action: { label: 'Undo', onClick: () => undefined },
            testid: 'toast-info',
          })
        }
      >
        Info + action
      </Button>
    </div>
  )
}

const meta = {
  title: 'Design System/Toast',
  component: Toast,
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Intents: Story = {
  render: () => (
    <Toast>
      <ToastDemo />
      <Toast.Viewport />
    </Toast>
  ),
}
