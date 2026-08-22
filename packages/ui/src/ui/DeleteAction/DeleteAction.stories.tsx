import type { Meta, StoryObj } from '@storybook/react-vite'
import { DeleteAction } from './index'

const meta = {
  title: 'Design System/DeleteAction',
  component: DeleteAction,
  args: {
    name: 'BOLT-HEX-38',
    label: 'product',
    onDelete: async () => undefined,
    'data-testid': 'story-delete-action',
  },
} satisfies Meta<typeof DeleteAction>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
