# demo

A full [Rhythm](https://github.com/rhythmjs/rhythm) application on Bun: email and password auth, PostgreSQL through
Drizzle, S3 file storage, outgoing mail, a generated OpenAPI document with a Scalar UI, and an hourly cleanup job.
It started from the `template/` starter and grew into an end-to-end project tracker (projects, tasks, attachments).

## What it shows

- **Modules and services.** Everything is a `Rhythm` module. `databaseModule`, `mailerModule` and `s3StorageModule`
  own the infrastructure and close it on `app.stop()`. A feature module (`projectsModule`, `tasksModule`) `include`s
  what it needs, builds its services with `decorate` (registrations run in order, so `db` is there), and mounts its own
  controllers; `tasksModule` carries both `tasksController` and `attachmentsController`. The app just does
  `.use(mount(projectsModule))`.
- **Routers.** Each controller is a `RhythmRouter` with full paths, wrapped in `documented()` so it appears in the
  OpenAPI document, and mounted by the module that owns it. Routers guard themselves with `.use(requireSession())`.
- **Auth.** [Better Auth](https://www.better-auth.com) through `betterAuthModule.forRootAsync`, which builds `auth` from
  the database and mailer and serves `/api/auth/**`. CORS comes before it for the cookie session.
- **Docs.** `openapiModule` serves `/openapi.json`, `scalarModule` serves `/docs`.
- **Scheduled work.** `src/jobs/cleanup.cron.ts` is a `RhythmCron` job that deletes expired sessions every hour;
  `startCron(cleanupCron)` starts it with the app and `app.stop()` stops it.
- **Serving.** `Bun.serve({ fetch: toFetchHandler(appModule) })` in `src/main.ts`.

```
src/
  main.ts                 Bun.serve
  app.module.ts           the app: startup registrations, cors, auth, mounted routers
  app.controller.ts       GET /, GET /me
  db/                     createDatabase, databaseModule, Drizzle schema, migrations runner
  infra/mailer            nodemailer service and templates
  infra/s3storage         S3 service on Bun's S3Client
  lib/auth.ts             createAuth(db, mailerService)
  projects/  tasks/       controller, service, schema (zod) and module per feature
  jobs/cleanup.cron.ts    expired-session cleanup
```

## Run it

```sh
docker compose up -d postgres minio mailpit
bun install
bun run db:migrate # apply drizzle/*.sql
bun run dev        # http://localhost:3000, API reference at /docs
```

Copy `.env.example` to `.env` to change ports, database, S3 or SMTP settings (Bun loads it). Mail goes to Mailpit
(UI on :8025) when `SMTP_HOST` is set and to a JSON transport otherwise. Set `BETTER_AUTH_SECRET` outside local runs.
After changing the schema, `bun run db:generate` emits a new migration.

## Endpoints

| Method and path                                                            | Notes                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /`                                                                    | Greeting                                                    |
| `GET /me`                                                                  | Current user (needs a session)                              |
| `ALL /api/auth/**`                                                         | Better Auth: sign up, sign in, verify email, reset password |
| `GET /openapi.json`, `GET /docs`                                           | OpenAPI document and Scalar UI                              |
| `GET, POST /projects`                                                      | List and create your projects                               |
| `GET, PATCH, DELETE /projects/:id`                                         | One project; deleting removes its tasks and stored files    |
| `GET, POST /projects/:projectId/tasks`                                     | List and create tasks                                       |
| `GET, PATCH, DELETE /projects/:projectId/tasks/:id`                        | One task                                                    |
| `GET, POST /projects/:projectId/tasks/:taskId/attachments`                 | List and upload (multipart field `file`, 10 MB max)         |
| `GET, DELETE /projects/:projectId/tasks/:taskId/attachments/:attachmentId` | GET redirects to a short-lived presigned URL                |

All routes under `/projects` need a session cookie from `/api/auth/sign-in/email`.

## Scripts

```sh
bun run dev        # run with reload on change
bun run start      # run once
bun test           # unit tests (no services needed)
bun run test:e2e   # end-to-end; the parts needing Postgres or S3 skip when they are unreachable
bun run check      # prettier --check, oxlint, tsc
```
