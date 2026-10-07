import { requireSession, type AuthContext } from "@rhythmjs/better-auth";
import { bodyLimit } from "@rhythmjs/http/body-limit";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiCookieAuth } from "@rhythmjs/openapi/security";
import { apiTags } from "@rhythmjs/openapi/tags";
import { documented } from "@rhythmjs/openapi/generate";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { z } from "zod";
import {
  attachmentParamSchema,
  attachmentSchema,
  MAX_ATTACHMENT_BYTES,
  taskScopeParamSchema,
  uploadAttachmentSchema,
} from "./attachments.schema";
import type { AttachmentsService } from "./attachments.service";

export type AttachmentsContext = RhythmHttpContext &
  AuthContext & {
    attachmentsService: AttachmentsService;
  };

const unauthorized = apiResponse(401, { description: "No session" });
const notFound = apiResponse(404, { description: "Project, task or attachment not found" });

export const attachmentsController = documented(new RhythmRouter<AttachmentsContext>())
  .use(apiTags("attachments"))
  .use(apiCookieAuth("cookieAuth"))
  .use(requireSession())
  .use(bodyLimit(MAX_ATTACHMENT_BYTES + 1024 * 1024))
  .get(
    "/projects/:projectId/tasks/:taskId/attachments",
    apiParam(taskScopeParamSchema),
    apiOperation({ summary: "List a task's attachments", operationId: "listAttachments" }),
    apiResponse(200, { description: "Attachment metadata", schema: z.array(attachmentSchema) }),
    unauthorized,
    notFound,
    async (ctx) => {
      const found = await ctx.attachmentsService.list(ctx.user.id, ctx.params.projectId, ctx.params.taskId);
      if (!found) return ctx.error(404, "Task not found");
      ctx.json(found);
    },
  )
  .post(
    "/projects/:projectId/tasks/:taskId/attachments",
    apiBody(uploadAttachmentSchema, { contentType: "multipart/form-data", description: "The file to attach" }),
    apiParam(taskScopeParamSchema),
    apiOperation({ summary: "Attach a file to a task", operationId: "uploadAttachment" }),
    apiResponse(201, { description: "The stored attachment", schema: attachmentSchema }),
    apiResponse(400, { description: "Missing or invalid file" }),
    apiResponse(413, { description: "File too large" }),
    unauthorized,
    notFound,
    async (ctx) => {
      const { file } = ctx.valid.body;
      const attachment = await ctx.attachmentsService.upload(
        ctx.user.id,
        ctx.params.projectId,
        ctx.params.taskId,
        file,
      );
      if (!attachment) return ctx.error(404, "Task not found");
      ctx.json(attachment, 201);
    },
  )
  .get(
    "/projects/:projectId/tasks/:taskId/attachments/:attachmentId",
    apiParam(attachmentParamSchema),
    apiOperation({
      summary: "Download an attachment",
      description: "Redirects to a short-lived presigned download URL.",
      operationId: "downloadAttachment",
    }),
    apiResponse(302, { description: "Redirect to the file" }),
    unauthorized,
    notFound,
    async (ctx) => {
      const url = await ctx.attachmentsService.downloadUrl(
        ctx.user.id,
        ctx.params.projectId,
        ctx.params.taskId,
        ctx.params.attachmentId,
      );
      if (!url) return ctx.error(404, "Attachment not found");
      ctx.redirect(url);
    },
  )
  .delete(
    "/projects/:projectId/tasks/:taskId/attachments/:attachmentId",
    apiParam(attachmentParamSchema),
    apiOperation({ summary: "Delete an attachment", operationId: "deleteAttachment" }),
    apiResponse(204, { description: "Deleted" }),
    unauthorized,
    notFound,
    async (ctx) => {
      const removed = await ctx.attachmentsService.remove(
        ctx.user.id,
        ctx.params.projectId,
        ctx.params.taskId,
        ctx.params.attachmentId,
      );
      if (!removed) return ctx.error(404, "Attachment not found");
      ctx.response.status = 204;
    },
  );
