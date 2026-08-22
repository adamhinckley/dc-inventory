# Defer Ops UI; keep `/ops` API mount in scaffold

Scaffold ships two Next apps — Internal (dashboard) and Wholesale (shop) — which are materially different products. `apps/ops` waits (see invariants G19). Backend still mounts empty `/ops`, emits stub `openapi/ops.yaml`, and generates `packages/api-client-ops` so the three-audience API contract stays intact without a third UI.
