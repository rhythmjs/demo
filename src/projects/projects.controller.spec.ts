import { describe, expect, test } from "bun:test";
import { mount } from "@rhythmjs/rhythm";
import { runHttpMiddleware } from "@rhythmjs/testing/router";
import { projectsController } from "./projects.controller";
import type { ProjectsService } from "./projects.service";

const user = { id: "u1", name: "Ada", email: "ada@example.com" };
const authStub = (result: unknown) => ({ api: { getSession: async () => result } }) as never;
const signedIn = { session: { id: "s1" }, user };

const run = (path: string, service: Partial<ProjectsService>, session: unknown = signedIn) =>
  runHttpMiddleware(mount(projectsController), path, {
    auth: authStub(session),
    projectsService: service as ProjectsService,
  });

describe("ProjectsController", () => {
  test("answers 401 without a session and never reaches the service", async () => {
    const { response } = await run(
      "/projects",
      {
        list: async () => {
          throw new Error("unreachable");
        },
      },
      null,
    );

    expect(response.status).toBe(401);
  });

  test("lists the caller's projects, scoped by their user id", async () => {
    let seen: unknown;
    const { response } = await run("/projects", {
      list: async (ownerId, query) => {
        seen = { ownerId, query };
        return [];
      },
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual({ ownerId: "u1", query: {} });
  });

  test("GET /projects/:id answers 404 when the service finds nothing", async () => {
    const { response } = await run("/projects/p1", { get: async () => undefined });

    expect(response.status).toBe(404);
  });
});
