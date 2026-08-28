import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingButton } from './index'

const meta = {
  title: 'Design System/LoadingButton',
  tags: ['autodocs'],
  component: LoadingButton,
  args: {
    children: 'Save product',
    variant: 'primary',
    'data-testid': 'story-loading-button',
  },
} satisfies Meta<typeof LoadingButton>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

export const Loading: Story = {
  args: { loading: true },
}

export const LoadingContent: Story = {
  args: { loading: true, loadingContent: 'Saving…' },
}

export const DestructiveLoading: Story = {
  args: { variant: 'destructive', children: 'Delete', loading: true },
}
