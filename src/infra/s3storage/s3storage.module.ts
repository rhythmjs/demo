import { decorate, Rhythm } from "@rhythmjs/rhythm";
import { createS3StorageService } from "./s3storage.service";

export const s3StorageModule = new Rhythm({ name: "s3storage" }).register(
  decorate(() => ({ s3StorageService: createS3StorageService() })),
);
