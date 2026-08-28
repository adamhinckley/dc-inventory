import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '#ds/ui/Button'
import { useConfirmDialog } from './index'

function ConfirmDemo() {
  const { confirm, dialog } = useConfirmDialog()
  return (
    <div className="flex flex-col gap-region">
      <div className="flex flex-wrap gap-action">
        <Button
          data-testid="story-confirm"
          onClick={() =>
            void confirm({
              title: 'Post this receipt?',
              description: 'On-hand will increase for every outstanding line.',
              confirmLabel: 'Receive',
              testid: 'story-confirm-dialog',
            })
          }
        >
          Confirm receive
        </Button>
        <Button
          variant="destructive"
          data-testid="story-confirm-destructive"
          onClick={() =>
            void confirm({
              title: 'Delete BOLT-HEX-38?',
              destructive: true,
              requireTyped: { phrase: 'BOLT-HEX-38', label: 'Type the SKU to confirm' },
              testid: 'story-confirm-typed',
            })
          }
        >
          Typed delete
        </Button>
      </div>
      {dialog}
    </div>
  )
}

const meta = {
  title: 'Design System/ConfirmDialog',
  tags: ['autodocs'],
  component: Button,
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Imperative: Story = {
  render: () => <ConfirmDemo />,
}
