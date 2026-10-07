import { describe, expect, test } from "bun:test";
import { mount } from "@rhythmjs/rhythm";
import { runHttpMiddleware } from "@rhythmjs/testing/router";
import { tasksController } from "./tasks.controller";
import type { TasksService } from "./tasks.service";

const user = { id: "u1", name: "Ada", email: "ada@example.com" };
const authStub = (result: unknown) => ({ api: { getSession: async () => result } }) as never;
const signedIn = { session: { id: "s1" }, user };

const run = (path: string, service: Partial<TasksService>, session: unknown = signedIn) =>
  runHttpMiddleware(mount(tasksController), path, {
    auth: authStub(session),
    tasksService: service as TasksService,
  });

describe("TasksController", () => {
  test("answers 401 without a session", async () => {
    const { response } = await run("/projects/p1/tasks", {}, null);

    expect(response.status).toBe(401);
  });

  test("lists tasks scoped by user and project, passing the filters through", async () => {
    let seen: unknown;
    const { response } = await run("/projects/p1/tasks?status=done", {
      list: async (ownerId, projectId, query) => {
        seen = { ownerId, projectId, query };
        return [];
      },
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual({ ownerId: "u1", projectId: "p1", query: { status: "done" } });
  });

  test("rejects an invalid filter with 400", async () => {
    const { response } = await run("/projects/p1/tasks?status=nope", {});

    expect(response.status).toBe(400);
  });

  test("GET /projects/:projectId/tasks/:id answers 404 when nothing is found", async () => {
    const { response } = await run("/projects/p1/tasks/t1", { get: async () => undefined });

    expect(response.status).toBe(404);
  });
});
