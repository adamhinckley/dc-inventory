import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReportChart } from "./report-chart";

const meta = {
  title: "ui-internal/ReportChart",
  component: ReportChart,
} satisfies Meta<typeof ReportChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const weeklyAvailable = {
  name: "Available",
  points: [
    { x: "W1", y: 40 },
    { x: "W2", y: 48 },
    { x: "W3", y: 36 },
    { x: "W4", y: 52 },
  ],
};

export const Line: Story = {
  args: {
    meta: { type: "line", xLabel: "Week", yUnit: "quantity" },
    series: [weeklyAvailable],
  },
};

export const Bar: Story = {
  args: {
    meta: { type: "bar", xLabel: "Week", yUnit: "count" },
    series: [weeklyAvailable],
  },
};

export const Kpi: Story = {
  args: {
    meta: { type: "kpi", yUnit: "quantity" },
    series: [weeklyAvailable],
  },
};
