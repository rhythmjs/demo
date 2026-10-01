import { createTransport, type SendMailOptions, type Transporter } from "nodemailer";
import { passwordResetMail, verificationMail, type MailContent } from "./mailer.templates";

export interface MailerOptions {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  transport?: Transporter;
}

function createSmtpTransport(options: MailerOptions): Transporter {
  const host = options.host ?? process.env.SMTP_HOST;
  if (!host) return createTransport({ jsonTransport: true });
  const user = options.user ?? process.env.SMTP_USER;
  return createTransport({
    host,
    port: options.port ?? Number(process.env.SMTP_PORT ?? 1025),
    auth: user ? { user, pass: options.pass ?? process.env.SMTP_PASS } : undefined,
  });
}

export function createMailer(options: MailerOptions = {}) {
  const transport = options.transport ?? createSmtpTransport(options);
  const from = options.from ?? process.env.MAIL_FROM ?? "Demo <no-reply@demo.local>";

  const send = (message: Omit<SendMailOptions, "from">) => transport.sendMail({ from, ...message });
  const sendContent = (to: string, content: MailContent) => send({ to, ...content });

  return {
    mailerService: {
      send,
      sendVerificationEmail: (to: string, name: string, url: string) => sendContent(to, verificationMail(name, url)),
      sendPasswordReset: (to: string, name: string, url: string) => sendContent(to, passwordResetMail(name, url)),
    },
    "#transport": transport,
  };
}

export type Mailer = ReturnType<typeof createMailer>;
export type MailerService = Mailer["mailerService"];

export function closeMailer(value: Mailer): void {
  value["#transport"].close();
}
