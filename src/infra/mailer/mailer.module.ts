import { decorate, Rhythm } from "@rhythmjs/rhythm";
import { closeMailer, createMailer, type MailerOptions } from "./mailer.service";

export const mailerModule = {
  forRoot(options: MailerOptions = {}) {
    const mailer = createMailer(options);
    return new Rhythm({ name: "mailer" }).register(
      decorate(() => ({ mailerService: mailer.mailerService })),
      () => closeMailer(mailer),
    );
  },
};
