import { RhythmCron } from "@rhythmjs/cron";
import { lt } from "drizzle-orm";
import type { Database } from "../db";
import { session } from "../db/schema";

export const cleanupCron = new RhythmCron<{ db: Database }>({ name: "cleanup", unref: true }).cron(
  "expired-sessions",
  "@hourly",
  async ({ db }) => {
    await db.delete(session).where(lt(session.expiresAt, new Date()));
  },
);
