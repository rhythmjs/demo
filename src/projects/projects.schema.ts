import { z } from "zod";

const name = z.string().trim().min(1, "name must be a non-empty string").max(120);
const description = z.string().trim().max(2000);
const status = z.enum(["active", "archived"]);

export const projectParamSchema = z.object({ id: z.string() });

export const listProjectsQuerySchema = z.object({ status: status.optional() });

export const createProjectSchema = z.object({
  name,
  description: description.default(""),
});

export const updateProjectSchema = z
  .object({ name: name.optional(), description: description.optional(), status: status.optional() })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'provide "name", "description" and/or "status" to update',
  });

export const projectSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  description: z.string(),
  status: status,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
