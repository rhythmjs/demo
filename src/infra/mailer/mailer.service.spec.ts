import { describe, expect, test } from "bun:test";
import { createTransport } from "nodemailer";
import { createMailer } from "./mailer.service";

const capture = () => {
  const { mailerService } = createMailer({
    transport: createTransport({ jsonTransport: true }),
    from: "Demo <no-reply@demo.local>",
  });
  const sent = async (send: () => Promise<{ message?: unknown }>) => {
    const info = await send();
    return JSON.parse(String(info.message)) as {
      subject: string;
      from: { address: string };
      to: { address: string }[];
      text: string;
      html: string;
    };
  };
  return { mailerService, sent };
};

describe("mailerService", () => {
  test("builds the verification mail with the link in both text and html", async () => {
    const { mailerService, sent } = capture();

    const mail = await sent(() =>
      mailerService.sendVerificationEmail("ada@example.com", "Ada", "http://app/verify?token=t1"),
    );

    expect(mail.subject).toBe("Verify your email address");
    expect(mail.from.address).toBe("no-reply@demo.local");
    expect(mail.to[0]!.address).toBe("ada@example.com");
    expect(mail.text).toContain("http://app/verify?token=t1");
    expect(mail.html).toContain('href="http://app/verify?token=t1"');
  });

  test("builds the password reset mail", async () => {
    const { mailerService, sent } = capture();

    const mail = await sent(() =>
      mailerService.sendPasswordReset("ada@example.com", "Ada", "http://app/reset?token=t2"),
    );

    expect(mail.subject).toBe("Reset your password");
    expect(mail.text).toContain("http://app/reset?token=t2");
  });

  test("escapes the recipient's name in the html body", async () => {
    const { mailerService, sent } = capture();

    const mail = await sent(() =>
      mailerService.sendVerificationEmail("x@example.com", "<script>alert(1)</script>", "http://app/v"),
    );

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
