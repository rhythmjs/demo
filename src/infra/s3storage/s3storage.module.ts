import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { createS3StorageService, type S3StorageOptions } from "./s3storage.service";

export const s3StorageModule = {
  forRoot(options: S3StorageOptions = {}) {
    const module = new Rhythm<RhythmHttpContext, { s3StorageService: ReturnType<typeof createS3StorageService> }>({
      name: "s3storage",
      type: "module",
    });
    module.context.s3StorageService = createS3StorageService(options);
    return module;
  },
};
