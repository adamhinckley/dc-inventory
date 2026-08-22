export function DashboardPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        {title}
      </h1>
      <p className="mt-2 text-sm text-secondary">{body}</p>
    </section>
  );
}
