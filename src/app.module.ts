import { betterAuthModule, cors } from "@rhythmjs/better-auth";
import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { startCron } from "@rhythmjs/cron";
import { decorate, include, mount, Rhythm } from "@rhythmjs/rhythm";
import { scalarModule } from "@rhythmjs/scalar";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { appController } from "./app.controller";
import { appService } from "./app.service";
import type { Database } from "./db";
import { databaseModule } from "./db/database.module";
import { mailerModule } from "./infra/mailer/mailer.module";
import type { MailerService } from "./infra/mailer/mailer.service";
import { s3StorageModule } from "./infra/s3storage/s3storage.module";
import { createAuth, frontendOrigin } from "./lib/auth";
import { cleanupCron } from "./jobs/cleanup.cron";
import { projectsModule } from "./projects/projects.module";
import { tasksModule } from "./tasks/tasks.module";

const openapiConfig = defineDocument({
  info: { title: "Rhythm Demo API", version: "0.0.2" },
  tags: [
    { name: "projects", description: "Projects owned by the signed-in user" },
    { name: "tasks", description: "Tasks inside a project" },
    { name: "attachments", description: "Files attached to a task, stored in S3" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
    },
  },
});

export const appModule = new Rhythm<{}, RhythmHttpContext>({ name: "app" })
  .register(include(databaseModule, ({ db }) => ({ db })))
  .register(include(mailerModule.forRoot(), ({ mailerService }) => ({ mailerService })))
  .register(include(s3StorageModule, ({ s3StorageService }) => ({ s3StorageService })))
  .register(decorate(() => ({ appService })))
  .register(startCron(cleanupCron))
  .use(mount(openapiModule.forRoot({ document: openapiConfig })))
  .use(mount(scalarModule.forRoot()))
  .use(cors({ origin: frontendOrigin, credentials: true, allowHeaders: ["Content-Type", "Authorization"] }))
  .use(
    betterAuthModule.forRootAsync({
      useFactory: ({ db, mailerService }: RhythmHttpContext & { db: Database; mailerService: MailerService }) =>
        createAuth(db, mailerService),
    }),
  )
  .use(mount(appController))
  .use(mount(projectsModule))
  .use(mount(tasksModule))
  .use((ctx) => {
    // mounted routers always continue, so only answer when nothing wrote a response
    if (ctx.response.status === 200 && ctx.response.body === null) {
      ctx.json({ success: false, status: 404, message: "Not Found" }, 404);
    }
  });

/** Releases the connections the app opened; call it on shutdown. */
export const closeApp = () => appModule.stop();
