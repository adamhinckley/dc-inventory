import type { Meta, StoryObj } from '@storybook/react-vite'
import { CountryFlag } from './index'

const meta = {
  title: 'Design System/CountryFlag',
  tags: ['autodocs'],
  component: CountryFlag,
  args: {
    code: 'US',
  },
} satisfies Meta<typeof CountryFlag>

export default meta
type Story = StoryObj<typeof meta>

export const UnitedStates: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-region">
      <CountryFlag code="CA" size={16} />
      <CountryFlag code="GB" size={20} />
      <CountryFlag code="MX" size={32} />
    </div>
  ),
}

export const Unknown: Story = {
  args: { code: 'zz' },
}
