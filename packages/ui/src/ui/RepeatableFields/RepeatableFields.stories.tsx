import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import { Form } from '#ds/ui/Form'
import { RepeatableFields } from './index'

const schema = z.object({
  aliases: z.array(z.object({ sku: z.string() })),
})

const meta = {
  title: 'Design System/RepeatableFields',
  component: RepeatableFields,
} satisfies Meta<typeof RepeatableFields>

export default meta
type Story = StoryObj<typeof meta>

export const Aliases: Story = {
  render: () => (
    <Form
      className="max-w-md"
      schema={schema}
      defaultValues={{ aliases: [{ sku: 'BOLT-HEX-38' }] }}
      onSubmit={() => undefined}
      data-testid="story-repeatable-form"
    >
      <RepeatableFields
        name="aliases"
        legend="Alternate SKUs"
        addLabel="Add alias"
        min={1}
        max={5}
        newItem={() => ({ sku: '' })}
        data-testid="story-repeatable"
      >
        {({ name }) => (
          <Form.Field name={name('sku')} label="SKU" form={{ kind: 'text' }} />
        )}
      </RepeatableFields>
      <Form.Actions>
        <Form.Submit data-testid="story-repeatable-submit">Save</Form.Submit>
      </Form.Actions>
    </Form>
  ),
}
