import { z } from "zod";

const title = z.string().trim().min(1, "title must be a non-empty string").max(200);
const description = z.string().trim().max(5000);
const status = z.enum(["todo", "in_progress", "done"]);
const priority = z.enum(["low", "medium", "high"]);
const dueAt = z.iso.datetime().transform((value) => new Date(value));

export const taskParamSchema = z.object({ projectId: z.string(), id: z.string() });
export const projectParamSchema = z.object({ projectId: z.string() });

export const listTasksQuerySchema = z.object({ status: status.optional(), priority: priority.optional() });

export const createTaskSchema = z.object({
  title,
  description: description.default(""),
  status: status.default("todo"),
  priority: priority.default("medium"),
  dueAt: dueAt.nullish(),
});

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
    priority: priority.optional(),
    dueAt: dueAt.nullable().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'provide "title", "description", "status", "priority" and/or "dueAt" to update',
  });

export const taskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  status,
  priority,
  dueAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
