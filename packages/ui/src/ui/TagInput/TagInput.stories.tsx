import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TagInput } from './index'

const meta = {
  title: 'Design System/TagInput',
  tags: ['autodocs'],
  component: TagInput,
} satisfies Meta<typeof TagInput>

export default meta
type Story = StoryObj<typeof meta>

export const WithTags: Story = {
  render: function WithTagsStory() {
    const [value, setValue] = useState(['fastener', 'zinc'])
    return (
      <div className="w-96">
        <TagInput
          value={value}
          onChange={setValue}
          placeholder="Add tag"
          data-testid="story-tag-input"
        />
      </div>
    )
  },
}

export const Compact: Story = {
  render: function CompactStory() {
    const [value, setValue] = useState<string[]>([])
    return (
      <div className="w-80">
        <TagInput
          density="compact"
          value={value}
          onChange={setValue}
          placeholder="Categories"
          data-testid="story-tag-input-compact"
        />
      </div>
    )
  },
}
