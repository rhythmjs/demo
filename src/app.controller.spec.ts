import { describe, expect, test } from "bun:test";
import { runHttpMiddleware } from "@rhythmjs/testing/router";
import { appController } from "./app.controller";
import { appService } from "./app.service";

const authStub = (result: unknown) => ({ api: { getSession: async () => result } }) as never;

const run = (path: string, service: typeof appService = appService, result: unknown = null) =>
  runHttpMiddleware(appController.middleware(), path, {
    appService: service,
    auth: authStub(result),
    session: null,
    user: null,
  });

describe("AppController", () => {
  test("GET / responds 200 with the service greeting", async () => {
    const { response } = await run("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(await response.text()).toBe("Hello World!");
  });

  test("delegates to the provided app service", async () => {
    const stub: typeof appService = { getHello: () => "Hello from the stub!" };

    const { response } = await run("/", stub);

    expect(await response.text()).toBe("Hello from the stub!");
  });

  test("passes unmatched routes through to the next middleware", async () => {
    const { nextCalled, response } = await run("/missing");

    expect(nextCalled).toBe(true);
    expect(await response.text()).toBe("");
  });

  test("GET /me answers 401 without a session", async () => {
    const { response } = await run("/me");

    expect(response.status).toBe(401);
  });

  test("GET /me answers with the signed-in user", async () => {
    const user = { id: "u1", name: "Ada", email: "ada@example.com" };
    const session = { expiresAt: new Date("2030-01-01T00:00:00.000Z") };
    const { response } = await run("/me", appService, { session, user });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...user, sessionExpiresAt: "2030-01-01T00:00:00.000Z" });
  });
});
