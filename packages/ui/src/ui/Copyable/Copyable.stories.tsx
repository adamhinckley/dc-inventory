import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyableLongText, CopyableText } from './index'

const meta = {
  title: 'Design System/Copyable',
  tags: ['autodocs'],
  component: CopyableText,
} satisfies Meta<typeof CopyableText>

export default meta
type Story = StoryObj<typeof meta>

export const ShortId: Story = {
  args: {
    value: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'data-testid': 'story-copyable-text',
  },
}

export const Wrapped: Story = {
  args: {
    value: 'https://internal.example/catalog/products/7c9e6679-7425-40de-944b-e07fc1f90ae7',
    wrap: true,
    'data-testid': 'story-copyable-wrap',
  },
}

export const LongText: Story = {
  render: () => (
    <div className="max-w-sm">
      <CopyableLongText
        value="Galvanized hex bolt, 3/8-16 x 2 in, zinc plated. Pack of 50. Used on trailer assemblies."
        data-testid="story-copyable-long"
      />
    </div>
  ),
}
