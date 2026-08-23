import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './index'

const meta = {
  title: 'Design System/Chip',
  component: Chip,
  args: {
    children: 'Wholesale',
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDot: Story = {
  args: {
    icon: <Chip.Dot />,
    children: 'On order',
    style: { '--chip-color': 'var(--color-status-assigned)' } as React.CSSProperties,
  },
}

export const Dismissible: Story = {
  args: {
    children: 'status:active',
    onDismiss: () => undefined,
  },
}

export const StatusTints: Story = {
  render: () => (
    <div className="flex flex-wrap gap-icon">
      <Chip style={{ '--chip-color': 'var(--color-success)' } as React.CSSProperties} icon={<Chip.Dot />}>
        In stock
      </Chip>
      <Chip style={{ '--chip-color': 'var(--color-warning)' } as React.CSSProperties} icon={<Chip.Dot />}>
        Low
      </Chip>
      <Chip style={{ '--chip-color': 'var(--color-error)' } as React.CSSProperties} icon={<Chip.Dot />}>
        Out
      </Chip>
      <Chip style={{ '--chip-color': 'var(--color-info)' } as React.CSSProperties} icon={<Chip.Dot />}>
        Incoming
      </Chip>
    </div>
  ),
}
