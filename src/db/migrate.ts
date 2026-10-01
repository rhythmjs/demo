import { migrate } from "drizzle-orm/bun-sql/migrator";
import { closeDatabase, createDatabase, type Database } from ".";

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle" });
}

if (import.meta.main) {
  const value = createDatabase();
  await runMigrations(value.db);
  await closeDatabase(value);
  console.log("database is up to date");
}
