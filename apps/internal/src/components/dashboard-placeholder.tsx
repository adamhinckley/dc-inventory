export function DashboardPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="max-w-2xl">
      <h1 className="page-title">{title}</h1>
      <p className="page-description mt-2">{body}</p>
    </section>
  );
}
