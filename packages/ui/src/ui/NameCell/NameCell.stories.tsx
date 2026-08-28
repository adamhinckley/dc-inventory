import type { Meta, StoryObj } from '@storybook/react-vite'
import { NameCell } from './index'

const meta = {
  title: 'Design System/NameCell',
  tags: ['autodocs'],
  component: NameCell,
  args: {
    name: 'Galvanized hex bolt',
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'data-testid': 'story-name-cell',
  },
} satisfies Meta<typeof NameCell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MissingName: Story = {
  args: { name: '' },
}
