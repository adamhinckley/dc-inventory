import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import { Button } from '#ds/ui/Button'
import { Form } from '#ds/ui/Form'
import { Toast } from '#ds/ui/Toast'
import { FormDialog } from './index'

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
})

const meta = {
  title: 'Design System/FormDialog',
  tags: ['autodocs'],
  component: FormDialog,
} satisfies Meta<typeof FormDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  render: () => (
    <Toast>
      <FormDialog
        trigger={
          <Button variant="primary" data-testid="story-form-dialog-trigger">
            New product
          </Button>
        }
        title="New product"
        description="Adds a catalog SKU. Quantities start at zero until you receive stock."
        schema={schema}
        defaultValues={{ sku: '', name: '' }}
        mutate={async (data) => data}
        successMessage="Product created"
        submitLabel="Create Product"
        data-testid="story-form-dialog"
      >
        <Form.Field name="sku" label="SKU" required form={{ kind: 'text' }} />
        <Form.Field name="name" label="Name" required form={{ kind: 'text' }} />
      </FormDialog>
      <Toast.Viewport />
    </Toast>
  ),
}
