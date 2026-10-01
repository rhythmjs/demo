import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { projects, taskAttachments, tasks, type Task } from "../db/schema";
import type { S3StorageService } from "../infra/s3storage/s3storage.service";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./tasks.schema";

export function createTasksService(db: Database, s3StorageService: S3StorageService) {
  async function ownsProject(ownerId: string, projectId: string): Promise<boolean> {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
    return project !== undefined;
  }

  return {
    async list(ownerId: string, projectId: string, query: ListTasksQuery): Promise<Task[] | undefined> {
      if (!(await ownsProject(ownerId, projectId))) return undefined;
      const filters = [eq(tasks.projectId, projectId)];
      if (query.status) filters.push(eq(tasks.status, query.status));
      if (query.priority) filters.push(eq(tasks.priority, query.priority));
      return db
        .select()
        .from(tasks)
        .where(and(...filters))
        .orderBy(asc(tasks.status), desc(tasks.createdAt));
    },
    async get(ownerId: string, projectId: string, id: string): Promise<Task | undefined> {
      if (!(await ownsProject(ownerId, projectId))) return undefined;
      const [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)));
      return task;
    },
    async create(ownerId: string, projectId: string, input: CreateTaskInput): Promise<Task | undefined> {
      if (!(await ownsProject(ownerId, projectId))) return undefined;
      const [task] = await db
        .insert(tasks)
        .values({
          ...input,
          projectId,
          dueAt: input.dueAt ?? null,
          completedAt: input.status === "done" ? new Date() : null,
        })
        .returning();
      return task;
    },
    async update(ownerId: string, projectId: string, id: string, patch: UpdateTaskInput): Promise<Task | undefined> {
      if (!(await ownsProject(ownerId, projectId))) return undefined;
      const completedAt =
        patch.status === undefined ? {} : { completedAt: patch.status === "done" ? new Date() : null };
      const [task] = await db
        .update(tasks)
        .set({ ...patch, ...completedAt })
        .where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
        .returning();
      return task;
    },
    async remove(ownerId: string, projectId: string, id: string): Promise<boolean> {
      if (!(await ownsProject(ownerId, projectId))) return false;
      const attachments = await db
        .select({ key: taskAttachments.key })
        .from(taskAttachments)
        .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
        .where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)));
      const deleted = await db
        .delete(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
        .returning({ id: tasks.id });
      if (deleted.length === 0) return false;
      await s3StorageService.removeMany(attachments.map((attachment) => attachment.key));
      return true;
    },
  };
}

export type TasksService = ReturnType<typeof createTasksService>;
