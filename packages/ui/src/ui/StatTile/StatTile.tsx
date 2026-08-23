// @ts-nocheck — sparkline charts are parked (Recharts lives in ui-internal).
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { AreaChart } from '#ds/ui/Charts/AreaChart'
import { ChartTooltip } from '#ds/ui/Charts/ChartTooltip'
import { Chip } from '#ds/ui/Chip'
import { TooltipHelp } from '#ds/ui/TooltipHelp'
import type { TimeSeries } from '#shared/charts/types'
import { useChartTooltip } from '#shared/charts/use-chart-tooltip'
import { cn } from '#cn'

/**
 * Axis tick: a bucket datetime → "Jul 14" (no year — the year is noise on a compact tile axis).
 * Bucket keys are UTC-stamped (`2026-01-05` / `…T00:00:00Z`), so format in UTC — without it a
 * viewer west of UTC renders every label one day early (house pattern: `format-date.ts`,
 * `timeline-brush.ts`).
 */
function formatDateTick(value: string | number): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export type StatTileTrendDirection = 'up' | 'down' | 'flat'

export interface StatTileTrend {
  direction: StatTileTrendDirection
  /** Magnitude only — the sign is conveyed by `direction`. Rendered as `N%`. */
  percent: number
  /**
   * Optional rich hover tooltip on the chip (title + description) — e.g. what changed and the
   * comparison period. The description also feeds the chip's accessible label.
   */
  tooltip?: { title?: string; description: string }
}

export interface StatTileProps extends Omit<ComponentPropsWithRef<'div'>, 'onSelect'> {
  /** Metric name, e.g. an email address or a PII type. */
  label: string
  /** Pre-formatted metric value — the tile does not format. */
  value: string
  /** Optional period-over-period trend. Direction drives both glyph and color. */
  trend?: StatTileTrend
  /** Optional in-tile trend line. */
  sparkline?: TimeSeries
  /** When set, the whole tile is a button (drill-through). */
  onSelect?: () => void
  /**
   * Called when a SPECIFIC sparkline data point is clicked, with its index — so a consumer can act
   * on that point (e.g. cross-filter by its date) rather than the whole-tile `onSelect`. The point
   * click is swallowed before it reaches the tile button, so `onSelect` does NOT also fire.
   * Mouse-only (the sparkline stays out of the tab order when the tile is a button).
   */
  onSelectPoint?: (index: number) => void
  /** Required. Format: `{feature}-{view}-{element}`. */
  'data-testid'?: string
}

/** Trend glyph + chip tint by direction. Up = more exposure (bad/red), down = better (green). */
const trendVariants: Record<
  StatTileTrendDirection,
  { Icon: typeof ArrowUp; tint: string; word: string }
> = {
  up: { Icon: ArrowUp, tint: '[--chip-color:var(--color-error)]', word: 'up' },
  down: { Icon: ArrowDown, tint: '[--chip-color:var(--color-success)]', word: 'down' },
  flat: { Icon: Minus, tint: '[--chip-color:var(--color-fg-tertiary)]', word: 'flat' },
}

function TrendChip({
  trend,
  testid,
  className,
}: {
  trend: StatTileTrend
  testid?: string
  className?: string
}) {
  const { Icon, tint, word } = trendVariants[trend.direction]
  const tip = trend.tooltip
  const chip = (
    <Chip
      icon={<Icon className="size-icon-sm" aria-hidden />}
      // `chip-tinted` gives the pill a faint fill on light surfaces (dark already has one).
      className={cn('chip-tinted', tint, className)}
      aria-label={`Trend ${word} ${trend.percent}%${tip ? `, ${tip.description}` : ''}`}
      data-testid={testid}
    >
      {trend.percent}%
    </Chip>
  )
  if (!tip) return chip
  // Rich hover tooltip (title + description). `asChild` makes the chip the trigger without adding a
  // tab stop, so it isn't a focusable widget inside the tile's `role="button"` (hover-only, like
  // legacy; the description is mirrored into the chip's aria-label for AT).
  return (
    <TooltipHelp asChild title={tip.title} description={tip.description} data-testid={testid}>
      {chip}
    </TooltipHelp>
  )
}

/**
 * A single stat card: label, a big pre-formatted value, an optional trend chip
 * (glyph + color — never color alone), and an optional embedded mini area chart
 * (its own x/y axes + a hover tooltip). Props-driven leaf — a data-driven grid
 * (PII types) renders N of these in a loop. When `onSelect` is set the whole tile
 * is a keyboard-operable button.
 */
export function StatTile({
  label,
  value,
  trend,
  sparkline,
  onSelect,
  onSelectPoint,
  className,
  ref,
  'data-testid': testid,
  ...rest
}: StatTileProps) {
  const interactive = Boolean(onSelect)
  // The mini-chart wires its own tooltip (a chart is dumb — see charts.md). Called
  // unconditionally; it no-ops until `sparkline` mounts the container.
  const { containerRef, tooltipRef, onHoverPoint, point, style } = useChartTooltip()

  // Sparkline y-axis: show only the top & bottom (2 labels). Pin the axis to the data's min/max
  // so those two labels ARE the actual low/high values (legacy parity); a flat series omits the
  // bounds and lets ECharts auto-scale.
  const sparkValues = sparkline ? sparkline.points.map((p) => p.value) : []
  const yMin = sparkValues.length ? Math.min(...sparkValues) : undefined
  const yMax = sparkValues.length ? Math.max(...sparkValues) : undefined
  // `interval: max - min` forces ticks EXACTLY at the low and high (no "nice" rounding that would
  // label a rounded value while the peak floats above it). A flat series omits the bounds.
  const yBounds =
    yMin != null && yMax != null && yMin !== yMax
      ? { min: yMin, max: yMax, interval: yMax - yMin }
      : {}

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-tight rounded-section border border-border bg-surface-card-raised p-card',
        interactive && 'cursor-pointer transition-colors hover:bg-interactive-hover',
        className,
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
      data-testid={testid}
      {...rest}
    >
      {/* Interactive: label left, trend chip top-right. Export/PDF: the trend chip drops to the
          value row (below) so the full label has the row to itself and isn't clipped (legacy
          parity). Both chips render once; CSS shows the one for the current mode. */}
      <div className="flex items-start justify-between gap-region">
        <span
          className="section-content-label truncate group-data-export/dashboard:overflow-visible group-data-export/dashboard:whitespace-normal"
          title={label}
        >
          {label}
        </span>
        {trend && (
          <TrendChip
            trend={trend}
            testid={`${testid}-trend`}
            className="shrink-0 group-data-export/dashboard:hidden"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-fg text-title-md">{value}</span>
        {trend && (
          <TrendChip
            trend={trend}
            testid={`${testid}-trend-export`}
            className="hidden shrink-0 group-data-export/dashboard:inline-flex"
          />
        )}
      </div>

      {sparkline && (
        // When the tile is a drill-through (`onSelect`), the sparkline is decorative for AT: it must
        // not be a focusable widget inside the tile's `role="button"`. `focusable={false}` takes it
        // out of the tab order and `aria-hidden` drops it from the AT tree. It STAYS mouse-hoverable
        // (the value/day tooltip). When `onSelectPoint` is set, a click on a data point fires it and
        // is stopped from bubbling to the tile — so a point click acts on that point, while a click
        // elsewhere on the tile bubbles up and drills the whole tile (keyboard Enter drills too).
        <div
          ref={containerRef}
          aria-hidden={interactive || undefined}
          onClick={onSelectPoint ? (event) => event.stopPropagation() : undefined}
          className="relative mt-3 h-20 w-full"
        >
          <AreaChart
            series={[sparkline]}
            area
            focusable={!interactive}
            onSelect={onSelectPoint ? (selection) => onSelectPoint(selection.dataIndex) : undefined}
            // Straight segments (matches the old sparkline), not a smoothed curve.
            containLabel
            // Headroom for the top y-tick label + margin for the last x-tick label — both overhang
            // the plot edge and would otherwise clip.
            padding={{ top: 8, right: 18 }}
            xAxis={{ showLine: false, showTicks: false, format: formatDateTick, maxLabels: 3 }}
            yAxis={{
              showLine: false,
              showTicks: false,
              showGrid: true,
              splitNumber: 1,
              ...yBounds,
            }}
            onHoverPoint={onHoverPoint}
            aria-label={`${label} trend`}
            data-testid={`${testid}-sparkline`}
          />
          {point && (
            <ChartTooltip
              ref={tooltipRef}
              point={point}
              style={style}
              data-testid={`${testid}-sparkline-tooltip`}
            />
          )}
        </div>
      )}
    </div>
  )
}
