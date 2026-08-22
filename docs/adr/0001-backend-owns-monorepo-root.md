# Backend scaffold owns the monorepo root

Scaffold is split into Backend and Frontend Linear projects. The Backend project owns `package.json`, `pnpm-workspace.yaml`, base `tsconfig*`, Vitest, and workspace scripts so the two projects do not race on root tooling. Frontend scaffold adds Next apps and UI packages into that workspace and depends on Backend landing first.
