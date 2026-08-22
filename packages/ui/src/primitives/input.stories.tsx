import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "ui/Input",
  component: Input,
  args: {
    placeholder: "SKU",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="sku">SKU</Label>
      <Input id="sku" {...args} />
    </div>
  ),
};
