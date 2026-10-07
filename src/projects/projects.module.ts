import { decorate, include, mount, Rhythm } from "@rhythmjs/rhythm";
import { databaseModule } from "../db/database.module";
import { s3StorageModule } from "../infra/s3storage/s3storage.module";
import { projectsController } from "./projects.controller";
import { createProjectsService } from "./projects.service";

export const projectsModule = new Rhythm({ name: "projects" })
  .register(include(databaseModule, ({ db }) => ({ db })))
  .register(include(s3StorageModule, ({ s3StorageService }) => ({ s3StorageService })))
  .register(decorate(({ db, s3StorageService }) => ({ projectsService: createProjectsService(db, s3StorageService) })))
  .use(mount(projectsController));
