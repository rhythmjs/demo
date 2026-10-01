import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentParamSchema = z.object({ projectId: z.string(), taskId: z.string(), attachmentId: z.string() });
export const taskScopeParamSchema = z.object({ projectId: z.string(), taskId: z.string() });

export const uploadAttachmentSchema = z.object({
  file: z.file().min(1, "file must not be empty").max(MAX_ATTACHMENT_BYTES, "file must be at most 10 MB"),
});

export const attachmentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  uploadedById: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  createdAt: z.iso.datetime(),
});
