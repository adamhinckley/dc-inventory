import type { Meta, StoryObj } from '@storybook/react-vite'
import { StackedCell } from './index'

const meta = {
  title: 'Design System/StackedCell',
  component: StackedCell,
  args: {
    primary: 'BOLT-HEX-38',
    secondary: 'Galvanized hex bolt',
    'data-testid': 'story-stacked-cell',
  },
} satisfies Meta<typeof StackedCell>

export default meta
type Story = StoryObj<typeof meta>

export const TwoLines: Story = {}

export const PrimaryOnly: Story = {
  args: { secondary: undefined },
}

export const Truncated: Story = {
  args: {
    truncatePrimary: true,
    primary: 'VERY-LONG-SKU-THAT-SHOULD-ELLIPSIZE-IN-A-NARROW-CELL',
    className: 'block max-w-40',
  },
}
