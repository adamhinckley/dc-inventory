import { defineConfig } from "orval";

const reactQuery = {
  client: "react-query" as const,
  httpClient: "fetch" as const,
  override: {
    query: {
      // Do not set useQuery: true globally — Orval then emits POST login/logout
      // as useQuery hooks that fire on mount. GET still defaults to useQuery;
      // POST defaults to useMutation.
      useInfinite: false,
    },
  },
};

export default defineConfig({
  internal: {
    input: "./openapi/internal.yaml",
    output: {
      ...reactQuery,
      target: "./packages/api-client-internal/src/generated/api.ts",
      schemas: "./packages/api-client-internal/src/generated/model",
      override: {
        ...reactQuery.override,
        mutator: {
          path: "./packages/api-client-internal/src/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
  wholesale: {
    input: "./openapi/wholesale.yaml",
    output: {
      ...reactQuery,
      target: "./packages/api-client-wholesale/src/generated/api.ts",
      schemas: "./packages/api-client-wholesale/src/generated/model",
      override: {
        ...reactQuery.override,
        mutator: {
          path: "./packages/api-client-wholesale/src/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
  ops: {
    input: "./openapi/ops.yaml",
    output: {
      ...reactQuery,
      target: "./packages/api-client-ops/src/generated/api.ts",
      schemas: "./packages/api-client-ops/src/generated/model",
      override: {
        ...reactQuery.override,
        mutator: {
          path: "./packages/api-client-ops/src/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
});
