import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { createS3StorageService, type S3StorageOptions } from "./s3storage.service";

export const s3StorageModule = {
  forRoot(options: S3StorageOptions = {}) {
    return new Rhythm<RhythmHttpContext>({ name: "s3storage", type: "module" }).provide(() => ({
      s3StorageService: createS3StorageService(options),
    }));
  },
};
