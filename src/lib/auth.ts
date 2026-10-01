import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db";
import * as schema from "../db/schema";
import type { MailerService } from "../infra/mailer/mailer.service";

export const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3001";

const inBackground = (task: Promise<unknown>): void => {
  task.catch((error) => console.error("failed to send auth email", error));
};

export function createAuth(db: Database, mailerService: MailerService) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET ?? "rhythmjs-demo-secret-change-me",
    trustedOrigins: [frontendOrigin],
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        inBackground(mailerService.sendPasswordReset(user.email, user.name, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        inBackground(mailerService.sendVerificationEmail(user.email, user.name, url));
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
