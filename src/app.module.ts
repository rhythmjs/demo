import { betterAuthModule, cors } from "@rhythmjs/better-auth";
import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { Rhythm } from "@rhythmjs/rhythm";
import { scalarModule } from "@rhythmjs/scalar";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { appController } from "./app.controller";
import { appService } from "./app.service";
import type { Database } from "./db";
import { databaseModule } from "./db/database.module";
import { mailerModule } from "./infra/mailer/mailer.module";
import type { MailerService } from "./infra/mailer/mailer.service";
import { s3StorageModule } from "./infra/s3storage/s3storage.module";
import { createAuth, frontendOrigin } from "./lib/auth";
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

export const appModule = new Rhythm<RhythmHttpContext>({ name: "app", type: "module" })
  .register(databaseModule.forRoot(), (deps) => ({ db: deps.db }))
  .register(mailerModule.forRoot(), (deps) => ({ mailerService: deps.mailerService }))
  .register(openapiModule.forRoot({ document: openapiConfig }))
  .register(scalarModule.forRoot())
  .use(cors({ origin: frontendOrigin, credentials: true, allowHeaders: ["Content-Type", "Authorization"] }))
  .register(
    betterAuthModule.forRootAsync({
      useFactory: ({ db, mailerService }: RhythmHttpContext & { db: Database; mailerService: MailerService }) =>
        createAuth(db, mailerService),
    }),
    (deps) => ({ auth: deps.auth }),
  )
  .register(s3StorageModule.forRoot(), (deps) => ({ s3StorageService: deps.s3StorageService }))
  .register(projectsModule)
  .register(tasksModule)
  .provide(() => ({ appService }))
  .use(appController.middleware())
  .use((ctx) => {
    ctx.response.status = 404;
    ctx.response.headers.set("content-type", "application/json");
    ctx.response.body = JSON.stringify({ success: false, status: 404, message: "Not Found" });
  });
