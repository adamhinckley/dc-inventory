import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '#ds/ui/Button'
import { ErrorBoundary } from './index'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Widget crashed while rendering.')
  return <p className="text-body">Catalog widget is healthy.</p>
}

const meta = {
  title: 'Design System/ErrorBoundary',
  tags: ['autodocs'],
  component: ErrorBoundary,
} satisfies Meta<typeof ErrorBoundary>

export default meta
type Story = StoryObj<typeof meta>

export const Caught: Story = {
  render: function CaughtStory() {
    const [boom, setBoom] = useState(true)
    return (
      <div className="flex max-w-md flex-col gap-region">
        <Button data-testid="story-boundary-toggle" onClick={() => setBoom((v) => !v)}>
          {boom ? 'Recover input' : 'Crash widget'}
        </Button>
        <ErrorBoundary resetKeys={[boom]} data-testid="story-error-boundary">
          <Boom shouldThrow={boom} />
        </ErrorBoundary>
      </div>
    )
  },
}
