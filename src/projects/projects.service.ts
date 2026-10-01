import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { projects, taskAttachments, tasks, type Project } from "../db/schema";
import type { S3StorageService } from "../infra/s3storage/s3storage.service";
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from "./projects.schema";

export function createProjectsService(db: Database, s3StorageService: S3StorageService) {
  return {
    list(ownerId: string, query: ListProjectsQuery): Promise<Project[]> {
      const owned = eq(projects.ownerId, ownerId);
      return db
        .select()
        .from(projects)
        .where(query.status ? and(owned, eq(projects.status, query.status)) : owned)
        .orderBy(desc(projects.createdAt));
    },
    async get(ownerId: string, id: string): Promise<Project | undefined> {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
      return project;
    },
    async create(ownerId: string, input: CreateProjectInput): Promise<Project> {
      const [project] = await db
        .insert(projects)
        .values({ ...input, ownerId })
        .returning();
      return project;
    },
    async update(ownerId: string, id: string, patch: UpdateProjectInput): Promise<Project | undefined> {
      const [project] = await db
        .update(projects)
        .set(patch)
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
        .returning();
      return project;
    },
    async remove(ownerId: string, id: string): Promise<boolean> {
      const attachments = await db
        .select({ key: taskAttachments.key })
        .from(taskAttachments)
        .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
      const deleted = await db
        .delete(projects)
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
        .returning({ id: projects.id });
      if (deleted.length === 0) return false;
      await s3StorageService.removeMany(attachments.map((attachment) => attachment.key));
      return true;
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
