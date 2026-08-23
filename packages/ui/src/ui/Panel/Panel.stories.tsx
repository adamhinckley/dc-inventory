import type { Meta, StoryObj } from '@storybook/react-vite'
import { Package } from 'lucide-react'
import { Button } from '#ds/ui/Button'
import { Panel } from './index'

const meta = {
  title: 'Design System/Panel',
  component: Panel,
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  render: () => (
    <div className="flex gap-region">
      <Panel variant="primary" size="md" data-testid="story-panel">
        <Panel.Header>
          <Panel.Title>
            <Panel.Title.Icon>
              <Package />
            </Panel.Title.Icon>
            <Panel.Title.Text>On hand</Panel.Title.Text>
          </Panel.Title>
          <Panel.Actions>
            <Button size="sm" data-testid="story-panel-action">
              Adjust
            </Button>
          </Panel.Actions>
        </Panel.Header>
        <Panel.Body>
          <p className="section-content-stat-value">50</p>
          <p className="section-content-stat-label">BOLT-HEX-38</p>
        </Panel.Body>
      </Panel>
      <Panel variant="secondary" size="md" data-testid="story-panel-flat">
        <Panel.Header>
          <Panel.Title>
            <Panel.Title.Text>Allocated</Panel.Title.Text>
          </Panel.Title>
        </Panel.Header>
        <Panel.Body>
          <p className="section-content-stat-value">2</p>
        </Panel.Body>
      </Panel>
    </div>
  ),
}
