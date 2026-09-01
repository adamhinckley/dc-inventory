export type DemoSeedStage =
  | "preflight"
  | "static master data"
  | "order playback"
  | "purchase order playback"
  | "sales order playback"
  | "payment playback"
  | "reorder policies"
  | "reconciliation";

export type DemoSeedProgressReporter = (stage: DemoSeedStage) => void;

export function createConsoleProgressReporter(): DemoSeedProgressReporter {
  return (stage) => {
    console.log(`Demo seed: ${stage}…`);
  };
}
