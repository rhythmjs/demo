import { decorate, include, mount, Rhythm } from "@rhythmjs/rhythm";
import { databaseModule } from "../db/database.module";
import { s3StorageModule } from "../infra/s3storage/s3storage.module";
import { attachmentsController } from "./attachments.controller";
import { createAttachmentsService } from "./attachments.service";
import { tasksController } from "./tasks.controller";
import { createTasksService } from "./tasks.service";

export const tasksModule = new Rhythm({ name: "tasks" })
  .register(include(databaseModule, ({ db }) => ({ db })))
  .register(include(s3StorageModule, ({ s3StorageService }) => ({ s3StorageService })))
  .register(
    decorate(({ db, s3StorageService }) => ({
      tasksService: createTasksService(db, s3StorageService),
      attachmentsService: createAttachmentsService(db, s3StorageService),
    })),
  )
  .use(mount(tasksController))
  .use(mount(attachmentsController));
