export function ShopPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-xl py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 text-ink-muted">{body}</p>
    </section>
  );
}
