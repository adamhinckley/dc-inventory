import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagList } from './index'

const meta = {
  title: 'Design System/TagList',
  component: TagList,
  args: {
    values: ['fastener', 'zinc', 'trailer'],
  },
} satisfies Meta<typeof TagList>

export default meta
type Story = StoryObj<typeof meta>

export const Tags: Story = {}

export const EmptyFallback: Story = {
  args: {
    values: [],
    emptyFallback: <span className="text-placeholder">No tags</span>,
  },
}
