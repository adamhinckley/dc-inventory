import type { Meta, StoryObj } from '@storybook/react-vite'
import { RouteError } from './index'

const meta = {
  title: 'Design System/RouteError',
  tags: ['autodocs'],
  component: RouteError,
  args: {
    error: Object.assign(new Error('load failed'), { digest: 'ABC123' }),
    reset: () => undefined,
    message: "We couldn't load this catalog page.",
    'data-testid': 'story-route-error',
  },
} satisfies Meta<typeof RouteError>

export default meta
type Story = StoryObj<typeof meta>

export const WithDigest: Story = {}

export const WithoutDigest: Story = {
  args: { error: new Error('load failed') },
}
