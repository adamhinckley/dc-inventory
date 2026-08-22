import type { Meta, StoryObj } from '@storybook/react-vite'
import { IdCell } from './index'

const meta = {
  title: 'Design System/IdCell',
  component: IdCell,
  args: {
    value: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'data-testid': 'story-id-cell',
  },
} satisfies Meta<typeof IdCell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
