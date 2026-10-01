import { SQL } from "bun";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

export const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/demo";

export type Database = BunSQLDatabase<typeof schema>;

export interface DatabaseValue {
  db: Database;
  "#client": SQL;
}

export function createDatabase(url: string = databaseUrl): DatabaseValue {
  const client = new SQL(url);
  return { db: drizzle({ client, schema }), "#client": client };
}

export async function closeDatabase(value: DatabaseValue): Promise<void> {
  await value["#client"].close();
}
