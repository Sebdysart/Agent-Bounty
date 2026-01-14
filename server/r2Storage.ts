import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface R2StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
}

interface R2HealthStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

interface UploadResult {
  success: boolean;
  key: string;
  error?: string;
}

interface DownloadResult {
  success: boolean;
  data: Buffer | null;
  contentType?: string;
  error?: string;
}

/**
 * Cloudflare R2 storage client wrapper using AWS S3-compatible API.
 * Implements file operations for agent code and submission artifacts.
 */
class R2StorageClient {
  private client: S3Client | null = null;
  private bucketName: string;
  private isConfigured = false;

  constructor(config?: R2StorageConfig) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = config?.bucketName || process.env.R2_BUCKET_NAME || "agent-bounty";

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
    }
  }

  /**
   * Check if R2 storage is configured and available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Upload agent source code to R2
   */
  async uploadAgentCode(agentId: string, code: string): Promise<UploadResult> {
    const key = `agents/${agentId}/source.js`;
    return this.upload(key, Buffer.from(code, "utf-8"), "application/javascript");
  }

  /**
   * Download agent source code from R2
   */
  async downloadAgentCode(agentId: string): Promise<string | null> {
    const key = `agents/${agentId}/source.js`;
    const result = await this.download(key);
    if (result.success && result.data) {
      return result.data.toString("utf-8");
    }
    return null;
  }

  /**
   * Upload a submission artifact to R2
   */
  async uploadArtifact(
    submissionId: string,
    file: Buffer,
    filename: string,
    contentType?: string
  ): Promise<UploadResult> {
    const key = `submissions/${submissionId}/artifacts/${filename}`;
    return this.upload(key, file, contentType || "application/octet-stream");
  }

  /**
   * Get a presigned URL for secure download
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.client) return null;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error(`R2 presigned URL error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get a presigned URL for agent code download
   */
  async getAgentCodeUrl(agentId: string, expiresIn: number = 3600): Promise<string | null> {
    const key = `agents/${agentId}/source.js`;
    return this.getPresignedUrl(key, expiresIn);
  }

  /**
   * Get a presigned URL for artifact download
   */
  async getArtifactUrl(
    submissionId: string,
    filename: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    const key = `submissions/${submissionId}/artifacts/${filename}`;
    return this.getPresignedUrl(key, expiresIn);
  }

  /**
   * Upload a file to R2
   */
  async upload(key: string, data: Buffer, contentType: string): Promise<UploadResult> {
    if (!this.client) {
      return {
        success: false,
        key,
        error: "R2 client not configured",
      };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: contentType,
      });
      await this.client.send(command);
      return { success: true, key };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`R2 upload error for key ${key}:`, errorMessage);
      return {
        success: false,
        key,
        error: errorMessage,
      };
    }
  }

  /**
   * Download a file from R2
   */
  async download(key: string): Promise<DownloadResult> {
    if (!this.client) {
      return {
        success: false,
        data: null,
        error: "R2 client not configured",
      };
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);

      if (!response.Body) {
        return {
          success: false,
          data: null,
          error: "Empty response body",
        };
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      return {
        success: true,
        data,
        contentType: response.ContentType,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`R2 download error for key ${key}:`, errorMessage);
      return {
        success: false,
        data: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a file from R2
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error(`R2 delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete agent code from R2
   */
  async deleteAgentCode(agentId: string): Promise<boolean> {
    const key = `agents/${agentId}/source.js`;
    return this.delete(key);
  }

  /**
   * Check if a file exists in R2
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      // NotFound errors are expected for non-existent objects
      return false;
    }
  }

  /**
   * List files with a given prefix
   */
  async list(prefix: string, maxKeys: number = 1000): Promise<string[]> {
    if (!this.client) return [];

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });
      const response = await this.client.send(command);
      return (response.Contents || []).map((obj) => obj.Key || "").filter(Boolean);
    } catch (error) {
      console.error(`R2 list error for prefix ${prefix}:`, error);
      return [];
    }
  }

  /**
   * List all artifacts for a submission
   */
  async listSubmissionArtifacts(submissionId: string): Promise<string[]> {
    const prefix = `submissions/${submissionId}/artifacts/`;
    const keys = await this.list(prefix);
    return keys.map((key) => key.replace(prefix, ""));
  }

  /**
   * Delete all files for an agent (cleanup)
   */
  async deleteAgentFiles(agentId: string): Promise<number> {
    const prefix = `agents/${agentId}/`;
    const keys = await this.list(prefix);
    let deleted = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Delete all artifacts for a submission (cleanup)
   */
  async deleteSubmissionArtifacts(submissionId: string): Promise<number> {
    const prefix = `submissions/${submissionId}/`;
    const keys = await this.list(prefix);
    let deleted = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Health check - verify R2 connectivity
   */
  async healthCheck(): Promise<R2HealthStatus> {
    if (!this.client) {
      return {
        connected: false,
        latencyMs: 0,
        error: "R2 client not configured",
      };
    }

    const start = Date.now();
    try {
      // List with 1 key limit to verify connectivity
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });
      await this.client.send(command);
      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Singleton instance for the application
export const r2Storage = new R2StorageClient();

// Export class for testing/custom instances
export { R2StorageClient };
export type { R2StorageConfig, R2HealthStatus, UploadResult, DownloadResult };
