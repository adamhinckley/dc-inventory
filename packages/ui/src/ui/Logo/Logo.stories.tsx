import type { Meta, StoryObj } from '@storybook/react-vite'
import { Logo, LogoAnimated } from './index'

const meta = {
  title: 'Design System/Logo',
  tags: ['autodocs'],
  component: Logo,
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {
  args: { variant: 'full' },
}

export const Mark: Story = {
  args: { variant: 'mark' },
}

export const Animated: Story = {
  render: () => (
    <div className="flex flex-col gap-region">
      <LogoAnimated expanded />
      <LogoAnimated expanded={false} />
    </div>
  ),
}
