import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { appModule, closeApp } from "../src/app.module";
import { closeDatabase, createDatabase } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { createS3StorageService } from "../src/infra/s3storage/s3storage.service";
import { createAuth } from "../src/lib/auth";

const probe = createDatabase();
const databaseUp = await probe.db.execute(sql`select 1`).then(
  () => true,
  () => false,
);
await closeDatabase(probe);

const s3 = createS3StorageService();
const s3Up = await s3.exists("probe").then(
  () => true,
  () => false,
);

describe("AppController (e2e)", () => {
  const app = toFetchHandler(appModule);

  afterAll(() => closeApp());

  test("/ (GET)", async () => {
    const res = await app(new Request("http://localhost/"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Hello World!");
  });

  test("/missing (GET) hits the module's not-found handler", async () => {
    const res = await app(new Request("http://localhost/missing"));

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await res.json()).toEqual({ success: false, status: 404, message: "Not Found" });
  });

  test("/openapi.json (GET) describes the routes and the cookie scheme", async () => {
    const res = await app(new Request("http://localhost/openapi.json"));
    const doc = (await res.json()) as { paths: Record<string, unknown>; components: { securitySchemes: object } };

    expect(res.status).toBe(200);
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        "/",
        "/me",
        "/projects",
        "/projects/{id}",
        "/projects/{projectId}/tasks",
        "/projects/{projectId}/tasks/{id}",
      ]),
    );
    expect(doc.components.securitySchemes).toHaveProperty("cookieAuth");
  });

  test("/docs (GET) serves the Scalar page", async () => {
    const res = await app(new Request("http://localhost/docs"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("/me (GET) is 401 without a session", async () => {
    const res = await app(new Request("http://localhost/me"));

    expect(res.status).toBe(401);
  });

  // Needs Postgres (`docker compose up -d postgres`); skipped when it is unreachable.
  describe.skipIf(!databaseUp)("with the database", () => {
    const value = createDatabase();
    const db = value.db;

    beforeAll(() => runMigrations(db));
    afterAll(() => closeDatabase(value));

    const signUp = async (name: string): Promise<string> => {
      const res = await app(
        new Request("http://localhost/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000" },
          body: JSON.stringify({
            name,
            email: `${name}-${crypto.randomUUID()}@example.com`,
            password: "correct-horse-battery",
          }),
        }),
      );
      expect(res.status).toBe(200);
      return res.headers
        .getSetCookie()
        .map((entry) => entry.split(";")[0])
        .join("; ");
    };

    const call = (cookie: string, method: string, path: string, body?: unknown) =>
      app(
        new Request(`http://localhost${path}`, {
          method,
          headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );

    test("sign up, then the session cookie unlocks /me", async () => {
      const cookie = await signUp("ada");
      const me = await call(cookie, "GET", "/me");

      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({ name: "ada", sessionExpiresAt: expect.any(String) });
    });

    test("projects and tasks require a session", async () => {
      for (const [method, path] of [
        ["GET", "/projects"],
        ["POST", "/projects"],
        ["GET", "/projects/p1/tasks"],
        ["DELETE", "/projects/p1/tasks/t1"],
      ] as const) {
        expect((await app(new Request(`http://localhost${path}`, { method }))).status).toBe(401);
      }
    });

    test("projects: create, list, filter, update, delete", async () => {
      const cookie = await signUp("grace");

      expect((await call(cookie, "POST", "/projects", { name: "  " })).status).toBe(400);

      const created = await call(cookie, "POST", "/projects", { name: "Launch", description: "Ship it" });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string; status: string };
      expect(project).toMatchObject({ name: "Launch", description: "Ship it", status: "active" });

      expect(await (await call(cookie, "GET", "/projects")).json()).toHaveLength(1);
      expect(await (await call(cookie, "GET", "/projects?status=archived")).json()).toHaveLength(0);
      expect((await call(cookie, "GET", "/projects?status=nope")).status).toBe(400);
      expect((await call(cookie, "GET", `/projects/${project.id}`)).status).toBe(200);

      const patched = await call(cookie, "PATCH", `/projects/${project.id}`, { status: "archived" });
      expect(await patched.json()).toMatchObject({ status: "archived" });
      expect((await call(cookie, "PATCH", `/projects/${project.id}`, {})).status).toBe(400);

      expect((await call(cookie, "DELETE", `/projects/${project.id}`)).status).toBe(204);
      expect((await call(cookie, "GET", `/projects/${project.id}`)).status).toBe(404);
    });

    test("tasks: full lifecycle inside a project, with completedAt tracking", async () => {
      const cookie = await signUp("linus");
      const project = (await (await call(cookie, "POST", "/projects", { name: "Kernel" })).json()) as { id: string };
      const base = `/projects/${project.id}/tasks`;

      expect((await call(cookie, "POST", base, { title: "x", dueAt: "tomorrow" })).status).toBe(400);

      const created = await call(cookie, "POST", base, {
        title: "Write tests",
        priority: "high",
        dueAt: "2030-01-01T00:00:00.000Z",
      });
      expect(created.status).toBe(201);
      const task = (await created.json()) as { id: string };
      expect(task).toMatchObject({
        title: "Write tests",
        status: "todo",
        priority: "high",
        dueAt: "2030-01-01T00:00:00.000Z",
        completedAt: null,
      });

      expect(await (await call(cookie, "GET", `${base}?priority=low`)).json()).toHaveLength(0);
      expect(await (await call(cookie, "GET", `${base}?priority=high`)).json()).toHaveLength(1);

      const done = await call(cookie, "PATCH", `${base}/${task.id}`, { status: "done" });
      expect(await done.json()).toMatchObject({ status: "done", completedAt: expect.any(String) });
      const reopened = await call(cookie, "PATCH", `${base}/${task.id}`, { status: "todo", dueAt: null });
      expect(await reopened.json()).toMatchObject({ status: "todo", completedAt: null, dueAt: null });

      expect((await call(cookie, "DELETE", `${base}/${task.id}`)).status).toBe(204);
      expect((await call(cookie, "GET", `${base}/${task.id}`)).status).toBe(404);
      expect((await call(cookie, "GET", "/projects/missing/tasks")).status).toBe(404);
    });

    test("users cannot see or touch each other's projects and tasks", async () => {
      const owner = await signUp("owner");
      const intruder = await signUp("intruder");
      const project = (await (await call(owner, "POST", "/projects", { name: "Private" })).json()) as { id: string };
      const task = (await (await call(owner, "POST", `/projects/${project.id}/tasks`, { title: "Secret" })).json()) as {
        id: string;
      };

      expect(await (await call(intruder, "GET", "/projects")).json()).toEqual([]);
      for (const [method, path, body] of [
        ["GET", `/projects/${project.id}`],
        ["PATCH", `/projects/${project.id}`, { name: "Mine now" }],
        ["DELETE", `/projects/${project.id}`],
        ["GET", `/projects/${project.id}/tasks`],
        ["POST", `/projects/${project.id}/tasks`, { title: "Planted" }],
        ["GET", `/projects/${project.id}/tasks/${task.id}`],
        ["PATCH", `/projects/${project.id}/tasks/${task.id}`, { title: "Hijacked" }],
        ["DELETE", `/projects/${project.id}/tasks/${task.id}`],
      ] as const) {
        expect((await call(intruder, method, path, body)).status).toBe(404);
      }

      const intact = await call(owner, "GET", `/projects/${project.id}/tasks/${task.id}`);
      expect(await intact.json()).toMatchObject({ title: "Secret" });
    });

    test("sign-up sends the verification email and a reset request sends the reset email", async () => {
      const sent: { kind: string; to: string; url: string }[] = [];
      const auth = createAuth(db, {
        send: async () => ({}),
        sendVerificationEmail: async (to: string, _name: string, url: string) => {
          sent.push({ kind: "verify", to, url });
        },
        sendPasswordReset: async (to: string, _name: string, url: string) => {
          sent.push({ kind: "reset", to, url });
        },
      } as never);
      const email = `mail-${crypto.randomUUID()}@example.com`;

      await auth.api.signUpEmail({ body: { name: "Mia", email, password: "correct-horse-battery" } });
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3001/reset" } });
      await Bun.sleep(50);

      expect(sent.map(({ kind, to }) => ({ kind, to }))).toEqual([
        { kind: "verify", to: email },
        { kind: "reset", to: email },
      ]);
      expect(sent[0]!.url).toContain("verify-email");
      expect(sent[1]!.url).toContain("reset-password");
    });

    // Needs S3-compatible storage (`docker compose up -d minio`); skipped when it is unreachable.
    describe.skipIf(!s3Up)("task attachments", () => {
      const upload = (cookie: string, base: string, name: string, content: string, type = "text/plain") => {
        const form = new FormData();
        form.set("file", new File([content], name, { type }));
        return app(new Request(`http://localhost${base}`, { method: "POST", headers: { cookie }, body: form }));
      };

      const setup = async (cookie: string) => {
        const project = (await (await call(cookie, "POST", "/projects", { name: "Files" })).json()) as { id: string };
        const task = (await (
          await call(cookie, "POST", `/projects/${project.id}/tasks`, { title: "Attach" })
        ).json()) as {
          id: string;
        };
        return { project, task, base: `/projects/${project.id}/tasks/${task.id}/attachments` };
      };

      test("upload, list, download through a presigned redirect, delete", async () => {
        const cookie = await signUp("files");
        const { base } = await setup(cookie);

        expect((await upload(cookie, base, "empty.txt", "", "text/plain")).status).toBe(400);

        const created = await upload(cookie, base, "notes.txt", "hello attachment");
        expect(created.status).toBe(201);
        const attachment = (await created.json()) as { id: string };
        expect(attachment).toMatchObject({
          fileName: "notes.txt",
          contentType: expect.stringContaining("text/plain"),
          size: 16,
        });
        expect(attachment).not.toHaveProperty("key");

        expect(await (await call(cookie, "GET", base)).json()).toHaveLength(1);

        const download = await app(
          new Request(`http://localhost${base}/${attachment.id}`, { headers: { cookie }, redirect: "manual" }),
        );
        expect(download.status).toBe(302);
        const file = await fetch(download.headers.get("location")!);
        expect(await file.text()).toBe("hello attachment");
        expect(file.headers.get("content-disposition")).toContain('filename="notes.txt"');

        expect((await call(cookie, "DELETE", `${base}/${attachment.id}`)).status).toBe(204);
        expect(await (await call(cookie, "GET", base)).json()).toEqual([]);
        expect((await fetch(download.headers.get("location")!)).status).toBe(404);
      });

      test("deleting the task or the project removes the stored objects", async () => {
        const cookie = await signUp("purge");
        const { project, task, base } = await setup(cookie);
        const urlOf = async (id: string) =>
          (
            await app(new Request(`http://localhost${base}/${id}`, { headers: { cookie }, redirect: "manual" }))
          ).headers.get("location")!;

        const first = (await (await upload(cookie, base, "a.txt", "a")).json()) as { id: string };
        const firstUrl = await urlOf(first.id);
        expect((await fetch(firstUrl)).status).toBe(200);
        expect((await call(cookie, "DELETE", `/projects/${project.id}/tasks/${task.id}`)).status).toBe(204);
        expect((await fetch(firstUrl)).status).toBe(404);

        const second = await setup(cookie);
        const kept = (await (await upload(cookie, second.base, "b.txt", "b")).json()) as { id: string };
        const keptUrl = (
          await app(
            new Request(`http://localhost${second.base}/${kept.id}`, { headers: { cookie }, redirect: "manual" }),
          )
        ).headers.get("location")!;
        expect((await fetch(keptUrl)).status).toBe(200);
        expect((await call(cookie, "DELETE", `/projects/${second.project.id}`)).status).toBe(204);
        expect((await fetch(keptUrl)).status).toBe(404);
      });

      test("another user cannot list, upload, download or delete a task's attachments", async () => {
        const owner = await signUp("keeper");
        const intruder = await signUp("snoop");
        const { base } = await setup(owner);
        const attachment = (await (await upload(owner, base, "secret.txt", "s")).json()) as { id: string };

        expect((await call(intruder, "GET", base)).status).toBe(404);
        expect((await upload(intruder, base, "planted.txt", "x")).status).toBe(404);
        expect((await call(intruder, "GET", `${base}/${attachment.id}`)).status).toBe(404);
        expect((await call(intruder, "DELETE", `${base}/${attachment.id}`)).status).toBe(404);
        expect(await (await call(owner, "GET", base)).json()).toHaveLength(1);
      });

      test("requires a session", async () => {
        expect((await app(new Request("http://localhost/projects/p/tasks/t/attachments"))).status).toBe(401);
      });
    });
  });
});
