export function PrototypeBanner() {
  return (
    <div
      className="rounded-section border border-warning/40 bg-warning/10 px-4 py-3 text-body-sm text-fg"
      data-testid="sell-windows-prototype-banner"
    >
      <strong>PROTOTYPE</strong> — in-memory only. List page shows saved windows;{" "}
      <strong>New Window</strong> opens a separate page with category/factory chips and
      labeled open/close dates.
    </div>
  );
}
