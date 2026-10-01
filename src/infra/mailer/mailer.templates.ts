export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function actionMail(subject: string, name: string, intro: string, label: string, url: string): MailContent {
  return {
    subject,
    text: `Hi ${name},\n\n${intro}\n\n${label}: ${url}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
  };
}

export const verificationMail = (name: string, url: string): MailContent =>
  actionMail(
    "Verify your email address",
    name,
    "Confirm your email address to finish setting up your account.",
    "Verify email",
    url,
  );

export const passwordResetMail = (name: string, url: string): MailContent =>
  actionMail("Reset your password", name, "We received a request to reset your password.", "Reset password", url);
