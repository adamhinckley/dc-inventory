/** PROTOTYPE — last stub ReopenSkusForPresell payload. */

export type StubReopenCommand = {
  skus: string[];
  excludedNeverOpen: string[];
  windowOpensAt: string | null;
  windowClosesAt: string | null;
};

export function CommandPreview({ command }: { command: StubReopenCommand | null }) {
  return (
    <aside className="rounded-section border border-border bg-surface-card p-4">
      <p className="text-label font-semibold text-fg-secondary">Prototype State</p>
      <p className="mt-1 text-body-sm text-fg-secondary">
        In-memory only. No inventory write. ADA-219 never-open is still open — year-round
        rows are flagged so you can judge filter-set accidents.
      </p>
      <pre className="mt-3 max-h-48 overflow-auto rounded-interactable bg-surface-raised p-3 text-body-sm text-fg">
        {command === null
          ? "No apply yet."
          : JSON.stringify(
              {
                command: "ReopenSkusForPresell",
                skuCount: command.skus.length,
                skus:
                  command.skus.length > 40
                    ? [...command.skus.slice(0, 40), `… +${command.skus.length - 40} more`]
                    : command.skus,
                excludedNeverOpen: command.excludedNeverOpen,
                windowOpensAt: command.windowOpensAt,
                windowClosesAt: command.windowClosesAt,
              },
              null,
              2,
            )}
      </pre>
    </aside>
  );
}
