/** OpenAPI `x-chart` on report operations. */
export type ChartMeta = {
  type: "line" | "bar" | "pie" | "kpi";
  xLabel?: string;
  yUnit?: "cents" | "count" | "quantity";
};

export type ChartPoint = {
  x: string;
  y: number;
};

export type ChartSeries = {
  name: string;
  points: readonly ChartPoint[];
};

export type ReportChartProps = {
  meta: ChartMeta;
  series: readonly ChartSeries[];
};
