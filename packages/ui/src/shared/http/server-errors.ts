export async function mapServerErrors(
  err: unknown,
  form: { setError: (name: never, error: { type?: string; message: string }) => void },
): Promise<void> {
  const message = err instanceof Error ? err.message : "Request failed";
  form.setError("root" as never, { message });
}
