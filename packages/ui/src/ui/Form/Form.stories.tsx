import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import { Form } from './index'

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  notes: z.string().optional(),
  trackLots: z.boolean(),
})

const meta = {
  title: 'Design System/Form',
  tags: ['autodocs'],
  component: Form,
} satisfies Meta<typeof Form>

export default meta
type Story = StoryObj<typeof meta>

export const CreateProduct: Story = {
  render: () => (
    <Form
      className="flex max-w-md flex-col gap-form-section"
      schema={schema}
      defaultValues={{ sku: '', name: '', notes: '', trackLots: false }}
      onSubmit={() => undefined}
      data-testid="story-form"
    >
      <Form.Fieldset label="Identity">
        <Form.Field name="sku" label="SKU" required form={{ kind: 'text' }} />
        <Form.Field name="name" label="Name" required form={{ kind: 'text' }} />
        <Form.Field
          name="notes"
          label="Notes"
          description="Shown on receiving paperwork."
          form={{ kind: 'textarea' }}
        />
        <Form.Field name="trackLots" label="Track lots" form={{ kind: 'boolean' }} />
      </Form.Fieldset>
      <Form.RootError />
      <Form.Actions>
        <Form.Submit data-testid="story-form-submit">Create Product</Form.Submit>
      </Form.Actions>
    </Form>
  ),
}
