import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './index'

const infoTint = { '--chip-color': 'var(--color-info)' } as React.CSSProperties

const meta = {
  title: 'Design System/Chip',
  tags: ['autodocs'],
  component: Chip,
  args: {
    children: 'Wholesale',
  },
  argTypes: {
    icon: { control: false },
    style: { control: false },
    onDismiss: { control: false },
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Status pill with a leading `Chip.Dot`. Tint via `--chip-color`. */
export const WithDot: Story = {
  render: () => (
    <Chip icon={<Chip.Dot />} style={infoTint}>
      On order
    </Chip>
  ),
}

/** In-flight action. The dot pulses until the request settles. */
export const Busy: Story = {
  render: () => (
    <Chip busy style={infoTint}>
      Saving
    </Chip>
  ),
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
