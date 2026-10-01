import type { AuthContext } from "@rhythmjs/better-auth";
import { derive, Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { Database } from "../db";
import type { S3StorageService } from "../infra/s3storage/s3storage.service";
import { attachmentsController } from "./attachments.controller";
import { createAttachmentsService } from "./attachments.service";
import { tasksController } from "./tasks.controller";
import { createTasksService } from "./tasks.service";

export type TasksModuleInput = RhythmHttpContext & AuthContext & { db: Database; s3StorageService: S3StorageService };

export const tasksModule = new Rhythm<TasksModuleInput>({ name: "tasks", type: "module" })
  .use(
    derive(({ db, s3StorageService }: TasksModuleInput) => ({
      tasksService: createTasksService(db, s3StorageService),
      attachmentsService: createAttachmentsService(db, s3StorageService),
    })),
  )
  .use(tasksController.middleware())
  .use(attachmentsController.middleware());
