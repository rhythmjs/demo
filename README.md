# demo

A demo app for [Rhythm](https://github.com/rhythmjs/rhythm), started from the `template/` starter and grown
into a real-world, end-to-end application.

## Structure

```
src/
  main.ts bootstraps the Bun server
  app.module.ts Rhythm instance: provides the service, mounts the controller, handles 404s
  app.controller.ts RhythmRouter instance: routes and handlers
  app.service.ts plain class holding the business logic
```

- The **service** is a plain class. The **module** provides it with `.provide()`, which makes it available
  on the request context of everything mounted after it.
- The **controller** is a `RhythmRouter` typed as `RhythmRouter<AppContext>`, so `ctx.appService` is fully
  typed inside every handler. The module mounts it with `.use(appController.routes())`.
- **main.ts** serves the module with a plain `Bun.serve` call; `toFetchHandler(appModule)` from `@rhythmjs/router/fetch` is its `fetch`.

## Getting started

```sh
bun install
bun run dev # bun --watch src/main.ts
```

Then:

```sh
curl http://localhost:3000/ # Hello World!
curl http://localhost:3000/missing # {"success":false,"status":404,"message":"Not Found"}
```

## Scripts

```sh
bun run dev # run with reload on change
bun run start # run once
bun test # bun test runner
bun run typecheck # tsc --noEmit
bun run check # prettier --check + oxlint + tsc
```

## Growing the app

Add a feature by repeating the pattern: a `users.service.ts` class, a `users.controller.ts` router (give it
a `prefix`), provide the service in `app.module.ts`, and mount the controller with `.use(...routes())`
before the 404 handler. Validation, sessions, logging, CORS, and friends are available as
[`@rhythmjs/middleware`](https://github.com/rhythmjs/middleware), [`@rhythmjs/http`](https://github.com/rhythmjs/http),
[`@rhythmjs/observability`](https://github.com/rhythmjs/observability), and
[`@rhythmjs/security`](https://github.com/rhythmjs/security).

## Auth and database

[Better Auth](https://www.better-auth.com) (email and password) on PostgreSQL through [Drizzle ORM](https://orm.drizzle.team)
and Bun's native `SQL` driver.

- `src/db/index.ts`: `createDatabase()` / `closeDatabase()`, provided with `.provide(() => database, closeDatabase)` (`DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/demo`).
- `src/db/schema/`: Better Auth's tables (`auth.schema.ts`) and the app's (`desk.schema.ts`: projects, tasks, task attachments).
- `src/lib/auth.ts`: `createAuth(db, mailerService)`, which also sends the verification and password-reset emails.
- `app.module.ts` mounts it with `betterAuthModule.forRoot({ auth })`; routers guard themselves with `.use(requireSession())`.

## Infrastructure

- `src/infra/mailer`: `mailerModule.forRoot()` provides `mailerService` (nodemailer). It uses SMTP when `SMTP_HOST` is set (Mailpit in `docker-compose.yml`, UI on :8025) and a JSON transport otherwise, so nothing is sent without configuration.
- `src/infra/s3storage`: `s3StorageModule.forRoot()` provides `s3StorageService` on Bun's `S3Client` (MinIO in `docker-compose.yml`, `S3_*` variables).
- Task attachments (`src/tasks/attachments.*`): `POST/GET /projects/:projectId/tasks/:taskId/attachments` (multipart field `file`, 10 MB max), `GET .../:attachmentId` redirects to a short-lived presigned URL, `DELETE .../:attachmentId`. Deleting a task or project also removes its stored objects.

```sh
docker compose up -d postgres minio mailpit
bun run db:migrate # apply drizzle/*.sql
bun run dev
```

After changing the schema, `bun run db:generate` emits a new migration. Set `BETTER_AUTH_SECRET` outside local runs. API reference: `/docs`.
