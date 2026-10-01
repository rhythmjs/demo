import { describe, expect, test } from "bun:test";
import { runHttpMiddleware } from "@rhythmjs/testing/router";
import { attachmentsController } from "./attachments.controller";
import type { AttachmentsService } from "./attachments.service";

const user = { id: "u1", name: "Ada", email: "ada@example.com" };
const authStub = (result: unknown) => ({ api: { getSession: async () => result } }) as never;
const signedIn = { session: { id: "s1" }, user };
const base = "/projects/p1/tasks/t1/attachments";

const run = (path: string, service: Partial<AttachmentsService>, session: unknown = signedIn) =>
  runHttpMiddleware(attachmentsController.middleware(), path, {
    auth: authStub(session),
    attachmentsService: service as AttachmentsService,
  });

describe("AttachmentsController", () => {
  test("answers 401 without a session", async () => {
    const { response } = await run(base, {}, null);

    expect(response.status).toBe(401);
  });

  test("does not run for unrelated paths, even without a session", async () => {
    const { nextCalled } = await run("/projects/p1/tasks/t1", {}, null);

    expect(nextCalled).toBe(true);
  });

  test("lists attachments scoped by user, project and task", async () => {
    let seen: unknown;
    const { response } = await run(base, {
      list: async (...args) => {
        seen = args;
        return [];
      },
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual(["u1", "p1", "t1"]);
  });

  test("download redirects to the presigned url", async () => {
    const { response } = await run(`${base}/a1`, { downloadUrl: async () => "http://s3.local/file?sig=1" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://s3.local/file?sig=1");
  });

  test("download answers 404 for an unknown attachment", async () => {
    const { response } = await run(`${base}/a1`, { downloadUrl: async () => undefined });

    expect(response.status).toBe(404);
  });
});
