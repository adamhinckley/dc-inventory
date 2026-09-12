/** Escape text interpolated into invite HTML. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inviteEmailHtml(input: {
  greetingName: string;
  paragraphs: readonly string[];
  setPasswordUrl: string;
  afterButton: readonly string[];
}): string {
  const greeting = escapeHtml(input.greetingName);
  const url = escapeHtml(input.setPasswordUrl);
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#161616;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const afterButton = input.afterButton
    .map(
      (paragraph) =>
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#525252;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f4f4;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 28px;background:#ffffff;border-radius:8px;">
    <p style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#161616;">Hello ${greeting},</p>
    ${paragraphs}
    <p style="margin:24px 0;">
      <a href="${url}" style="display:inline-block;padding:12px 20px;background:#0f62fe;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:4px;">Set your password</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6f6f6f;word-break:break-all;">If the button does not open, paste this link into your browser:<br />${url}</p>
    ${afterButton}
  </div>
</body>
</html>`;
}
