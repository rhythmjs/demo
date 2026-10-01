import { requireSession, type AuthContext } from "@rhythmjs/better-auth";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiCookieAuth } from "@rhythmjs/openapi/security";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { appService } from "./app.service";

export type AppContext = RhythmHttpContext &
  AuthContext & {
    appService: typeof appService;
  };

export const appController = new RhythmRouter<AppContext>()
  .get(
    "/",
    apiOperation({ summary: "Say hello", operationId: "getHello" }),
    apiResponse(200, { description: "A greeting", content: { "text/plain": { schema: { type: "string" } } } }),
    (ctx) => {
      ctx.response.headers.set("content-type", "text/plain");
      ctx.response.body = ctx.appService.getHello();
    },
  )
  .get(
    "/me",
    requireSession(),
    apiOperation({ summary: "Current user", operationId: "getMe" }),
    apiCookieAuth("cookieAuth"),
    apiResponse(200, { description: "The signed-in user" }),
    apiResponse(401, { description: "No session" }),
    (ctx) => {
      ctx.json({
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        sessionExpiresAt: ctx.session.expiresAt,
      });
    },
  );
