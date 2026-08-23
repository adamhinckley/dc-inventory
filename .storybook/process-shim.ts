/**
 * Vite/Storybook run in the browser. Next.js client modules and Recharts
 * still read `process.env.NODE_ENV` at module init.
 */
if (typeof globalThis.process === "undefined") {
  Object.assign(globalThis, {
    process: { env: { NODE_ENV: "development" } },
  });
}
