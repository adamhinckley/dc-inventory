import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = {
  title: 'Design System/Tokens',
  tags: ['autodocs'],
  parameters: {
    // This is a palette reference card: swatches intentionally render every
    // color — including vivid brand accents (primary/accent) not meant for
    // small text and the sub-threshold fg-muted token. The "Aa" glyph only
    // previews the content-on-color pairing. Real contrast obligations live
    // in the components that consume these tokens, not in the swatch grid.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
}
export default meta

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-10 w-10 rounded-interactable border border-border ${className}`} />
      <span className="text-body-sm text-fg-secondary">{name}</span>
    </div>
  )
}

function ColorRow({ name, bg, fg }: { name: string; bg: string; fg?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-10 w-20 items-center justify-center rounded-interactable border border-border"
        style={{ backgroundColor: `var(${bg})` }}
      >
        {fg && (
          <span className="text-label" style={{ color: `var(${fg})` }}>
            Aa
          </span>
        )}
      </div>
      <span className="text-body-sm text-fg-secondary">{name}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-title-sm text-fg">{title}</h2>
      {children}
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-body-emphasis text-fg-secondary">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const Colors: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Section title="Surfaces">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-surface-base" className="bg-surface-base" />
          <Swatch name="bg-surface-raised" className="bg-surface-raised" />
          <Swatch name="bg-surface-card" className="bg-surface-card" />
          <Swatch name="bg-surface-card-raised" className="bg-surface-card-raised" />
          <Swatch name="bg-surface-overlay" className="bg-surface-overlay" />
        </div>
      </Section>

      <Section title="Foreground">
        <div className="flex flex-wrap gap-3">
          {(['fg', 'fg-secondary', 'fg-tertiary', 'fg-muted'] as const).map((name) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-interactable border border-border bg-surface-card">
                <span className={`text-title-sm text-${name}`}>Aa</span>
              </div>
              <span className="text-body-sm text-fg-secondary">{`text-${name}`}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-wrap gap-3">
          <ColorRow name="bg-info" bg="--color-info" fg="--color-info-content" />
          <ColorRow name="bg-success" bg="--color-success" fg="--color-success-content" />
          <ColorRow name="bg-warning" bg="--color-warning" fg="--color-warning-content" />
          <ColorRow name="bg-error" bg="--color-error" fg="--color-error-content" />
          <ColorRow name="bg-caution" bg="--color-caution" fg="--color-caution-content" />
          <Swatch name="bg-info-tint" className="bg-info-tint" />
        </div>
      </Section>

      <Section title="Brand">
        <div className="flex flex-wrap gap-3">
          <ColorRow name="bg-primary" bg="--color-primary" fg="--color-primary-content" />
          <ColorRow
            name="bg-primary-strong"
            bg="--color-primary-strong"
            fg="--color-primary-content"
          />
          <ColorRow name="bg-secondary" bg="--color-secondary" fg="--color-secondary-content" />
          <ColorRow name="bg-accent" bg="--color-accent" fg="--color-accent-content" />
          <ColorRow name="bg-neutral" bg="--color-neutral" fg="--color-neutral-content" />
          <ColorRow name="bg-brand" bg="--color-brand" />
          <Swatch name="bg-accent-indicator" className="bg-accent-indicator" />
          <Swatch name="bg-secondary-tint" className="bg-secondary-tint" />
        </div>
      </Section>

      <Section title="Borders">
        <div className="flex flex-wrap gap-3">
          <Swatch name="border-border" className="border-2 border-border! bg-surface-card" />
          <Swatch
            name="border-border-subtle"
            className="border-2 border-border-subtle! bg-surface-card"
          />
          <Swatch
            name="border-border-field"
            className="border-2 border-border-field! bg-surface-card"
          />
          <Swatch
            name="border-border-field-hover"
            className="border-2 border-border-field-hover! bg-surface-card"
          />
          <Swatch
            name="border-border-field-strong"
            className="border-2 border-border-field-strong! bg-surface-card"
          />
        </div>
      </Section>

      <Section title="Interactive">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-interactive" className="bg-interactive" />
          <Swatch name="bg-interactive-hover" className="bg-interactive-hover" />
          <Swatch name="bg-interactive-active" className="bg-interactive-active" />
          <Swatch name="bg-interactive-strong" className="bg-interactive-strong" />
          <Swatch name="bg-selected" className="bg-selected" />
          <Swatch name="bg-range-tint" className="bg-range-tint" />
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-backdrop" className="bg-backdrop" />
        </div>
      </Section>

      <Section title="Exposure">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-exposure-very-low" className="bg-exposure-very-low" />
          <Swatch name="bg-exposure-low" className="bg-exposure-low" />
          <Swatch name="bg-exposure-medium" className="bg-exposure-medium" />
          <Swatch name="bg-exposure-high" className="bg-exposure-high" />
          <Swatch name="bg-exposure-very-high" className="bg-exposure-very-high" />
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-status-open" className="bg-status-open" />
          <Swatch name="bg-status-assigned" className="bg-status-assigned" />
          <Swatch name="bg-status-confirming" className="bg-status-confirming" />
          <Swatch name="bg-status-verifying" className="bg-status-verifying" />
          <Swatch name="bg-status-coordinating" className="bg-status-coordinating" />
          <Swatch name="bg-status-mitigated" className="bg-status-mitigated" />
          <Swatch name="bg-status-cleared" className="bg-status-cleared" />
          <Swatch name="bg-status-removed" className="bg-status-removed" />
          <Swatch name="bg-status-withdrawn" className="bg-status-withdrawn" />
          <Swatch name="bg-status-declined" className="bg-status-declined" />
          <Swatch name="bg-status-disclosed" className="bg-status-disclosed" />
          <Swatch name="bg-status-suppressed" className="bg-status-suppressed" />
        </div>
      </Section>

      <Section title="Match">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bg-match-low" className="bg-match-low" />
          <Swatch name="bg-match-medium" className="bg-match-medium" />
          <Swatch name="bg-match-high" className="bg-match-high" />
          <Swatch name="bg-match-exact" className="bg-match-exact" />
        </div>
      </Section>

      <Section title="Data Viz">
        <div className="flex flex-wrap gap-3">
          <Swatch name="bar-chart" className="bg-bar-chart" />
        </div>
      </Section>
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Typography Composites
// ---------------------------------------------------------------------------

const typeComposites = [
  { name: 'text-display', className: 'text-display', sample: 'Display 36px/700' },
  { name: 'text-title-lg', className: 'text-title-lg', sample: 'Title Large 24px/600' },
  { name: 'text-title-md', className: 'text-title-md', sample: 'Title Medium 20px/600' },
  { name: 'text-title-base', className: 'text-title-base', sample: 'Title Base 18px/600' },
  { name: 'text-title-sm', className: 'text-title-sm', sample: 'Title Small 16px/500' },
  { name: 'text-title-xs', className: 'text-title-xs', sample: 'Title XS 14px/500' },
  { name: 'text-body', className: 'text-body', sample: 'Body 14px/400' },
  { name: 'text-body-emphasis', className: 'text-body-emphasis', sample: 'Body Emphasis 14px/500' },
  { name: 'text-body-sm', className: 'text-body-sm', sample: 'Body Small 12px/400' },
  { name: 'text-label', className: 'text-label', sample: 'Label 12px/500' },
  { name: 'text-button', className: 'text-button', sample: 'Button 12px/500' },
  { name: 'text-input', className: 'text-input', sample: 'Input 14px/400' },
  { name: 'text-caption', className: 'text-caption', sample: 'Caption 11px/400' },
  { name: 'text-overline', className: 'text-overline', sample: 'Overline 10px/500' },
  { name: 'text-badge', className: 'text-badge', sample: 'Badge 10px/600' },
  { name: 'text-code', className: 'text-code font-mono', sample: 'Code 12px/400' },
  { name: 'text-2xs', className: 'text-2xs', sample: '2XS 10px (size only)' },
]

export const Typography: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Section title="Type Composites">
        <div className="flex flex-col gap-4">
          {typeComposites.map(({ name, className, sample }) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-40 shrink-0 text-body-sm text-fg-tertiary">{name}</span>
              <span className={`text-fg ${className}`}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Text Roles
// ---------------------------------------------------------------------------

export const TextRoles: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Section title="Shell (elevation-0)">
        <div className="rounded-section bg-surface-base p-card">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="shell-nav-group">Nav Group</span>
              <span className="text-caption text-fg-muted">shell-nav-group</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="shell-nav-item">Nav Item</span>
              <span className="text-caption text-fg-muted">shell-nav-item</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="shell-nav-item-active">Nav Item Active</span>
              <span className="text-caption text-fg-muted">shell-nav-item-active</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Page (elevation-1)">
        <div className="page rounded-section p-card">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="page-title">Page Title</span>
              <span className="text-caption text-fg-muted">page-title</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="page-description">Page description text</span>
              <span className="text-caption text-fg-muted">page-description</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="page-breadcrumb">Accounts</span>
                <span className="page-breadcrumb-separator">/</span>
                <span className="page-breadcrumb-current">Details</span>
              </div>
              <span className="text-caption text-fg-muted">
                page-breadcrumb / page-breadcrumb-separator / page-breadcrumb-current
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Section (elevation-2)">
        <div className="flex gap-3">
          <div className="section rounded-section flex-1 p-card">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="section-content-heading">Section Heading</span>
                <span className="text-caption text-fg-muted">section-content-heading</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-title">Content Title</span>
                <span className="text-caption text-fg-muted">section-content-title</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-description">Description text in a card</span>
                <span className="text-caption text-fg-muted">section-content-description</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-label">Data Label</span>
                <span className="text-caption text-fg-muted">section-content-label</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-value">Data Value</span>
                <span className="text-caption text-fg-muted">section-content-value</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-value-mono">a1b2c3d4</span>
                <span className="text-caption text-fg-muted">section-content-value-mono</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-subtitle">Subtitle text</span>
                <span className="text-caption text-fg-muted">section-content-subtitle</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-timestamp">Feb 21, 2026 5:42 PM</span>
                <span className="text-caption text-fg-muted">section-content-timestamp</span>
              </div>
            </div>
          </div>
          <div className="section-flat rounded-section flex-1 p-card">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="section-content-heading">Flat Section</span>
                <span className="text-caption text-fg-muted">section-content-heading</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-column-header">Column Header</span>
                <span className="text-caption text-fg-muted">section-content-column-header</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-stat-label">Stat Label</span>
                <span className="text-caption text-fg-muted">section-content-stat-label</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="section-content-stat-value">142</span>
                <span className="text-caption text-fg-muted">section-content-stat-value</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Overlay (elevation-3)">
        <div className="overlay rounded-section p-card shadow-overlay">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="overlay-title">Overlay Title</span>
              <span className="text-caption text-fg-muted">overlay-title</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="overlay-description">Overlay description text</span>
              <span className="text-caption text-fg-muted">overlay-description</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="overlay-group-label">Group Label</span>
              <span className="text-caption text-fg-muted">overlay-group-label</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Shared">
        <div className="section-flat rounded-section p-card">
          <div className="flex flex-col gap-3">
            <SubSection title="Form Roles">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="form-section-label">Form Section Label</span>
                  <span className="text-caption text-fg-muted">form-section-label</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="form-label">Form Label</span>
                  <span className="text-caption text-fg-muted">form-label</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="form-description">Helper text for the field</span>
                  <span className="text-caption text-fg-muted">form-description</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="form-error">Validation error message</span>
                  <span className="text-caption text-fg-muted">form-error</span>
                </div>
              </div>
            </SubSection>
            <div className="flex flex-col gap-1">
              <span className="text-placeholder">Placeholder / empty state text</span>
              <span className="text-caption text-fg-muted">text-placeholder</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

function GapDemo({ name, token }: { name: string; token: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-52 shrink-0 text-body-sm text-fg-secondary">{name}</span>
      <div className="flex items-center" style={{ gap: `var(${token})` }}>
        <div className="h-8 w-12 rounded-interactable bg-surface-card border border-border" />
        <div className="h-8 w-12 rounded-interactable bg-surface-card border border-border" />
        <div className="h-8 w-12 rounded-interactable bg-surface-card border border-border" />
      </div>
    </div>
  )
}

function PaddingDemo({ name, tokenX, tokenY }: { name: string; tokenX: string; tokenY: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-52 shrink-0 text-body-sm text-fg-secondary">{name}</span>
      <div
        className="rounded-interactable bg-primary/15"
        style={{
          paddingLeft: `var(${tokenX})`,
          paddingRight: `var(${tokenX})`,
          paddingTop: `var(${tokenY})`,
          paddingBottom: `var(${tokenY})`,
        }}
      >
        <div className="rounded-sm bg-surface-card border border-border px-3 py-1.5 text-body-sm text-fg-secondary">
          content
        </div>
      </div>
    </div>
  )
}

function PaddingUniformDemo({ name, token }: { name: string; token: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-52 shrink-0 text-body-sm text-fg-secondary">{name}</span>
      <div className="rounded-interactable bg-primary/15" style={{ padding: `var(${token})` }}>
        <div className="rounded-sm bg-surface-card border border-border px-3 py-1.5 text-body-sm text-fg-secondary">
          content
        </div>
      </div>
    </div>
  )
}

export const Spacing: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Section title="Gaps">
        <div className="flex flex-col gap-3">
          <GapDemo name="gap-tight (4px)" token="--space-tight-gap" />
          <GapDemo name="gap-icon (8px)" token="--space-icon-gap" />
          <GapDemo name="gap-action (8px)" token="--space-action-gap" />
          <GapDemo name="gap-region (12px)" token="--space-region-gap" />
          <GapDemo name="gap-field (8px)" token="--space-field-gap" />
          <GapDemo name="gap-field-group (16px)" token="--space-field-group-gap" />
          <GapDemo name="gap-form-section (24px)" token="--space-form-section-gap" />
        </div>
      </Section>

      <Section title="Padding — Uniform">
        <div className="flex flex-col gap-3">
          <PaddingUniformDemo name="p-card (16px)" token="--space-card-padding" />
          <PaddingUniformDemo name="p-panel (20px)" token="--space-panel-padding" />
          <PaddingUniformDemo name="p-canvas (16px)" token="--space-canvas-padding" />
          <PaddingUniformDemo name="p-page-gutter (32px)" token="--space-page-gutter" />
          <PaddingUniformDemo name="p-page-section (48px)" token="--space-page-section" />
          <PaddingUniformDemo name="p-page-hero (64px)" token="--space-page-hero" />
        </div>
      </Section>

      <Section title="Padding — Axis">
        <div className="flex flex-col gap-3">
          <PaddingDemo
            name="px-input-x (12px) / py-input-y (8px)"
            tokenX="--space-input-padding-x"
            tokenY="--space-input-padding-y"
          />
          <PaddingDemo
            name="px-button-x (16px) / py-button-y (10px)"
            tokenX="--space-button-padding-x"
            tokenY="--space-button-padding-y"
          />
          <PaddingDemo
            name="px-item-x (8px) / py-item-y (4px)"
            tokenX="--space-item-padding-x"
            tokenY="--space-item-padding-y"
          />
          <PaddingDemo
            name="px-section-content-x (12px) / py-section-content-y (8px)"
            tokenX="--space-section-content-x"
            tokenY="--space-section-content-y"
          />
          <PaddingDemo
            name="px-region-x (16px) / py-region-y (12px)"
            tokenX="--space-region-padding-x"
            tokenY="--space-region-padding-y"
          />
        </div>
      </Section>

      <Section title="Radius">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-interactable border-2 border-border bg-surface-card" />
            <span className="text-body-sm text-fg-secondary">rounded-interactable (6px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-section border-2 border-border bg-surface-card" />
            <span className="text-body-sm text-fg-secondary">rounded-section (10px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-page border-2 border-border bg-surface-card" />
            <span className="text-body-sm text-fg-secondary">rounded-page (12px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-full border-2 border-border bg-surface-card" />
            <span className="text-body-sm text-fg-secondary">rounded-full (9999px)</span>
          </div>
        </div>
      </Section>

      <Section title="Icon sizes">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="size-icon-sm rounded-sm bg-fg" />
            <span className="text-body-sm text-fg-secondary">size-icon-sm (12px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="size-icon rounded-sm bg-fg" />
            <span className="text-body-sm text-fg-secondary">size-icon (14px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="size-icon-lg rounded-sm bg-fg" />
            <span className="text-body-sm text-fg-secondary">size-icon-lg (16px)</span>
          </div>
        </div>
      </Section>
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export const Layers: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-6">
      <Section title="Elevation Stack">
        <div className="rounded-page bg-surface-base p-6">
          <span className="text-body-sm text-fg-secondary">E0 — Shell</span>
          <span className="text-caption text-fg-tertiary">bg-surface-base</span>

          <div className="page mt-3 rounded-page p-6">
            <span className="text-body-sm text-fg-secondary">E1 — Page</span>
            <span className="text-caption text-fg-tertiary">page</span>

            <div className="mt-3 flex gap-3">
              <div className="section flex-1 rounded-section p-card">
                <span className="text-body-sm text-fg-secondary">E2 — Section (primary)</span>
                <span className="text-caption text-fg-tertiary">section</span>
                <p className="section-content-value mt-2">Focal card with gradient border</p>
              </div>
              <div className="section-flat flex-1 rounded-section p-card">
                <span className="text-body-sm text-fg-secondary">E2 — Section (flat)</span>
                <span className="text-caption text-fg-tertiary">section-flat</span>
                <p className="section-content-value mt-2">Supporting card with solid border</p>
              </div>
            </div>

            <div className="section-flat mt-3 rounded-section p-card">
              <span className="text-body-sm text-fg-secondary">E2 — Section (flat) panel</span>
              <span className="text-caption text-fg-tertiary">section-flat</span>
              <div className="mt-3 rounded-section border border-border bg-surface-card-raised p-card">
                <span className="text-body-sm text-fg-secondary">E2+ — Raised card</span>
                <span className="text-caption text-fg-tertiary">bg-surface-card-raised</span>
                <p className="section-content-value mt-2">Card lifted off a same-surface panel</p>
              </div>
            </div>

            <div className="overlay mt-3 rounded-section p-card shadow-overlay">
              <span className="text-body-sm text-fg-secondary">E3 — Overlay</span>
              <span className="text-caption text-fg-tertiary">overlay</span>
              <p className="overlay-description mt-2">Floating surface with shadow</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Z-index stack">
        <p className="text-body-sm text-fg-tertiary">
          Named utilities used by AppShell and overlay components. Portaled popups
          must sit above <code className="text-caption">z-content</code>.
        </p>
        <div className="flex flex-col gap-2 text-body-sm">
          <p>
            <code>z-content</code> 1 — page body
          </p>
          <p>
            <code>z-chrome</code> 20 — sidebar, topbar
          </p>
          <p>
            <code>z-popover</code> 30 — combobox, select, menu, tooltip, dialog
          </p>
          <p>
            <code>z-drawer</code> 40 — edge drawers
          </p>
          <p>
            <code>z-toast</code> 50 — toast viewport
          </p>
        </div>
      </Section>

      <Section title="Elevation Shadows">
        <p className="text-body-sm text-fg-tertiary">
          Two tiers paralleling the z-index stack. Theme-varying — dark mode boosts the alpha so
          shadows read on dark surfaces.
        </p>
        <div className="flex gap-6 bg-surface-base p-8">
          <div className="overlay flex-1 rounded-section p-card shadow-overlay">
            <span className="text-body-sm text-fg">shadow-overlay</span>
            <p className="text-caption text-fg-tertiary mt-1">
              Popover-class — tooltips, menus, popovers, select/combobox/autocomplete popups
            </p>
          </div>
          <div className="overlay flex-1 rounded-section p-card shadow-modal">
            <span className="text-body-sm text-fg">shadow-modal</span>
            <p className="text-caption text-fg-tertiary mt-1">
              Modal-class — dialogs, drawers, toasts
            </p>
          </div>
        </div>
      </Section>
    </div>
  ),
}
