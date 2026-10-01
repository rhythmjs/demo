import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { projects, taskAttachments, tasks } from "../db/schema";
import type { S3StorageService } from "../infra/s3storage/s3storage.service";

export type AttachmentView = Omit<typeof taskAttachments.$inferSelect, "key">;

const view = {
  id: taskAttachments.id,
  taskId: taskAttachments.taskId,
  uploadedById: taskAttachments.uploadedById,
  fileName: taskAttachments.fileName,
  contentType: taskAttachments.contentType,
  size: taskAttachments.size,
  createdAt: taskAttachments.createdAt,
};

export function createAttachmentsService(db: Database, s3StorageService: S3StorageService) {
  async function ownsTask(ownerId: string, projectId: string, taskId: string): Promise<boolean> {
    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), eq(projects.ownerId, ownerId)));
    return task !== undefined;
  }

  async function find(taskId: string, id: string) {
    const [attachment] = await db
      .select()
      .from(taskAttachments)
      .where(and(eq(taskAttachments.id, id), eq(taskAttachments.taskId, taskId)));
    return attachment;
  }

  return {
    async list(ownerId: string, projectId: string, taskId: string): Promise<AttachmentView[] | undefined> {
      if (!(await ownsTask(ownerId, projectId, taskId))) return undefined;
      return db
        .select(view)
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, taskId))
        .orderBy(asc(taskAttachments.createdAt));
    },
    async upload(ownerId: string, projectId: string, taskId: string, file: File): Promise<AttachmentView | undefined> {
      if (!(await ownsTask(ownerId, projectId, taskId))) return undefined;
      const key = `tasks/${taskId}/${crypto.randomUUID()}`;
      const contentType = file.type || "application/octet-stream";
      await s3StorageService.put(key, file, contentType);
      try {
        const [attachment] = await db
          .insert(taskAttachments)
          .values({ taskId, uploadedById: ownerId, key, fileName: file.name, contentType, size: file.size })
          .returning(view);
        return attachment;
      } catch (error) {
        await s3StorageService.remove(key).catch(() => {});
        throw error;
      }
    },
    async downloadUrl(ownerId: string, projectId: string, taskId: string, id: string): Promise<string | undefined> {
      if (!(await ownsTask(ownerId, projectId, taskId))) return undefined;
      const attachment = await find(taskId, id);
      return attachment && s3StorageService.url(attachment.key, { fileName: attachment.fileName });
    },
    async remove(ownerId: string, projectId: string, taskId: string, id: string): Promise<boolean> {
      if (!(await ownsTask(ownerId, projectId, taskId))) return false;
      const deleted = await db
        .delete(taskAttachments)
        .where(and(eq(taskAttachments.id, id), eq(taskAttachments.taskId, taskId)))
        .returning({ key: taskAttachments.key });
      if (deleted.length === 0) return false;
      await s3StorageService.removeMany(deleted.map((attachment) => attachment.key));
      return true;
    },
  };
}

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
