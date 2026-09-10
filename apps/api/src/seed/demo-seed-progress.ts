export type DemoSeedStage =
  | "preflight"
  | "static master data"
  | "order playback"
  | "purchase order playback"
  | "sales order playback"
  | "payment playback"
  | "reorder policies"
  | "reconciliation"
  | "customer accounting playback"
  | "customer accounting showcase validation";

export type DemoSeedProgressReporter = (stage: DemoSeedStage) => void;

export function createConsoleProgressReporter(): DemoSeedProgressReporter {
  return (stage) => {
    console.log(`Demo seed: ${stage}…`);
  };
}
