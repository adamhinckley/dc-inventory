import type { Meta, StoryObj } from '@storybook/react-vite'
import { ErrorState } from './index'

const meta = {
  title: 'Design System/ErrorState',
  tags: ['autodocs'],
  component: ErrorState,
  args: {
    title: 'Could not load catalog',
    message: 'The products list request failed. Try again.',
    'data-testid': 'story-error-state',
  },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const WithRetry: Story = {
  args: { onRetry: () => undefined },
}

export const Retrying: Story = {
  args: { onRetry: () => undefined, retrying: true },
}

export const MessageOnly: Story = {
  args: { title: undefined, message: 'Inventory service timed out.' },
}
