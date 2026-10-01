import { S3Client } from "bun";

export interface S3StorageOptions {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  client?: S3Client;
}

export interface UrlOptions {
  fileName?: string;
  expiresIn?: number;
}

function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function createS3StorageService(options: S3StorageOptions = {}) {
  const client =
    options.client ??
    new S3Client({
      endpoint: options.endpoint ?? process.env.S3_ENDPOINT ?? "http://localhost:9000",
      region: options.region ?? process.env.S3_REGION ?? "us-east-1",
      bucket: options.bucket ?? process.env.S3_BUCKET ?? "uploads",
      accessKeyId: options.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
      secretAccessKey: options.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
    });

  return {
    async put(key: string, body: Blob, contentType: string): Promise<void> {
      await client.write(key, body, { type: contentType });
    },
    async remove(key: string): Promise<void> {
      await client.delete(key);
    },
    async removeMany(keys: readonly string[]): Promise<void> {
      await Promise.allSettled(keys.map((key) => client.delete(key)));
    },
    exists(key: string): Promise<boolean> {
      return client.exists(key);
    },
    url(key: string, { fileName, expiresIn = 300 }: UrlOptions = {}): string {
      return client.presign(key, {
        expiresIn,
        ...(fileName ? { contentDisposition: attachmentDisposition(fileName) } : {}),
      });
    },
  };
}

export type S3StorageService = ReturnType<typeof createS3StorageService>;
