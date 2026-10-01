import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { closeMailer, createMailer, type MailerOptions } from "./mailer.service";

export const mailerModule = {
  forRoot(options: MailerOptions = {}) {
    const mailer = createMailer(options);
    const module = new Rhythm<RhythmHttpContext>({ name: "mailer", type: "module" }).provide(() => mailer, closeMailer);
    return Object.assign(module, { mailerService: mailer.mailerService });
  },
};
