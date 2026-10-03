import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { closeDatabase, createDatabase, type Database } from ".";

export interface DatabaseModuleOptions {
  url?: string;
}

export const databaseModule = {
  forRoot(options: DatabaseModuleOptions = {}) {
    const database = createDatabase(options.url);
    const module = new Rhythm<RhythmHttpContext, { db: Database }>({ name: "database", type: "module" });
    module.context.db = database.db;
    return Object.assign(module, { close: () => closeDatabase(database) });
  },
};
