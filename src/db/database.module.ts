import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { closeDatabase, createDatabase } from ".";

export interface DatabaseModuleOptions {
  url?: string;
}

export const databaseModule = {
  forRoot(options: DatabaseModuleOptions = {}) {
    const database = createDatabase(options.url);
    const module = new Rhythm<RhythmHttpContext>({ name: "database", type: "module" }).provide(
      () => database,
      closeDatabase,
    );
    return Object.assign(module, { db: database.db });
  },
};
