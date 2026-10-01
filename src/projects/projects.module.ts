import type { AuthContext } from "@rhythmjs/better-auth";
import { derive, Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { Database } from "../db";
import type { S3StorageService } from "../infra/s3storage/s3storage.service";
import { projectsController } from "./projects.controller";
import { createProjectsService } from "./projects.service";

export type ProjectsModuleInput = RhythmHttpContext &
  AuthContext & { db: Database; s3StorageService: S3StorageService };

export const projectsModule = new Rhythm<ProjectsModuleInput>({ name: "projects", type: "module" })
  .use(
    derive(({ db, s3StorageService }: ProjectsModuleInput) => ({
      projectsService: createProjectsService(db, s3StorageService),
    })),
  )
  .use(projectsController.middleware());
