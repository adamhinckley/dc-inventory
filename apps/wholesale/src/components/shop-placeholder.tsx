export function ShopPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-xl py-8">
      <p className="section-title">Shop</p>
      <h1 className="page-title mt-2">{title}</h1>
      <p className="mt-4 text-ink-muted">{body}</p>
    </section>
  );
}
