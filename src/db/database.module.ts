import { decorate, Rhythm } from "@rhythmjs/rhythm";
import { closeDatabase, createDatabase } from ".";

const database = createDatabase();

export const databaseModule = new Rhythm({ name: "database" }).register(
  decorate(() => ({ db: database.db })),
  () => closeDatabase(database),
);
