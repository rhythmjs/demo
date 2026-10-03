import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { closeMailer, createMailer, type MailerOptions, type MailerService } from "./mailer.service";

export const mailerModule = {
  forRoot(options: MailerOptions = {}) {
    const mailer = createMailer(options);
    const module = new Rhythm<RhythmHttpContext, { mailerService: MailerService }>({ name: "mailer", type: "module" });
    module.context.mailerService = mailer.mailerService;
    return Object.assign(module, { close: () => closeMailer(mailer) });
  },
};
