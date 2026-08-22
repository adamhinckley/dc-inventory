# Storybook targets shared UI packages only

One monorepo Storybook covers `packages/ui` and `packages/ui-internal` (primitives and `DataTable`). App-level page stories are deferred until real screens exist, so scaffold proves the component contract agents reuse rather than snapshotting empty routes.
