/**
 * Tests for Cloudflare R2 Storage client wrapper
 * Mocks the @aws-sdk/client-s3 package to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { R2StorageClient } from '../r2Storage';

// Mock readable stream for download responses
const createMockStream = (data: string) => {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(data);
  return {
    [Symbol.asyncIterator]: async function* () {
      yield uint8Array;
    }
  };
};

// Mock the @aws-sdk/client-s3 module
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
    },
    PutObjectCommand: class MockPutObjectCommand {
      constructor(public input: any) {}
    },
    GetObjectCommand: class MockGetObjectCommand {
      constructor(public input: any) {}
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      constructor(public input: any) {}
    },
    HeadObjectCommand: class MockHeadObjectCommand {
      constructor(public input: any) {}
    },
    ListObjectsV2Command: class MockListObjectsV2Command {
      constructor(public input: any) {}
    },
  };
});

// Mock the presigner
vi.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/file'),
  };
});

describe('R2StorageClient', () => {
  let client: R2StorageClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create client with mock config
    client = new R2StorageClient({
      accountId: 'mock-account-id',
      accessKeyId: 'mock-access-key',
      secretAccessKey: 'mock-secret-key',
      bucketName: 'test-bucket',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when configured', () => {
      expect(client.isAvailable()).toBe(true);
    });

    it('should return false when not configured', () => {
      const unconfiguredClient = new R2StorageClient({});
      expect(unconfiguredClient.isAvailable()).toBe(false);
    });
  });

  describe('uploadAgentCode', () => {
    it('should upload agent code successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.uploadAgentCode('agent-123', 'console.log("hello")');

      expect(result.success).toBe(true);
      expect(result.key).toBe('agents/agent-123/source.js');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should return error when upload fails', async () => {
      mockSend.mockRejectedValue(new Error('Upload failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.uploadAgentCode('agent-123', 'code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
      consoleSpy.mockRestore();
    });

    it('should return error when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.uploadAgentCode('agent-123', 'code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 client not configured');
    });
  });

  describe('downloadAgentCode', () => {
    it('should download agent code successfully', async () => {
      const code = 'console.log("test")';
      mockSend.mockResolvedValue({
        Body: createMockStream(code),
        ContentType: 'application/javascript',
      });

      const result = await client.downloadAgentCode('agent-123');

      expect(result).toBe(code);
    });

    it('should return null when download fails', async () => {
      mockSend.mockRejectedValue(new Error('Not found'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.downloadAgentCode('agent-123');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should return null when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.downloadAgentCode('agent-123');

      expect(result).toBeNull();
    });
  });

  describe('uploadArtifact', () => {
    it('should upload artifact successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.uploadArtifact(
        'submission-456',
        Buffer.from('artifact data'),
        'output.json',
        'application/json'
      );

      expect(result.success).toBe(true);
      expect(result.key).toBe('submissions/submission-456/artifacts/output.json');
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned URL', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const result = await client.getPresignedUrl('test-key', 7200);

      expect(result).toBe('https://signed-url.example.com/file');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should return null when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.getPresignedUrl('test-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      (getSignedUrl as any).mockRejectedValueOnce(new Error('Signing error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.getPresignedUrl('test-key');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getAgentCodeUrl', () => {
    it('should return presigned URL for agent code', async () => {
      const result = await client.getAgentCodeUrl('agent-123');

      expect(result).toBe('https://signed-url.example.com/file');
    });
  });

  describe('getArtifactUrl', () => {
    it('should return presigned URL for artifact', async () => {
      const result = await client.getArtifactUrl('submission-456', 'output.json');

      expect(result).toBe('https://signed-url.example.com/file');
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.delete('test-key');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockSend.mockRejectedValue(new Error('Delete failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.delete('test-key');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.delete('test-key');

      expect(result).toBe(false);
    });
  });

  describe('deleteAgentCode', () => {
    it('should delete agent code', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.deleteAgentCode('agent-123');

      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.exists('existing-key');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockSend.mockRejectedValue(new Error('NotFound'));

      const result = await client.exists('nonexistent-key');

      expect(result).toBe(false);
    });

    it('should return false when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.exists('any-key');

      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list files by prefix', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: 'agents/1/source.js' },
          { Key: 'agents/2/source.js' },
        ],
      });

      const result = await client.list('agents/');

      expect(result).toEqual(['agents/1/source.js', 'agents/2/source.js']);
    });

    it('should return empty array when no files', async () => {
      mockSend.mockResolvedValue({
        Contents: [],
      });

      const result = await client.list('empty-prefix/');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockSend.mockRejectedValue(new Error('List failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.list('error-prefix/');

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should return empty array when client not configured', async () => {
      const unconfiguredClient = new R2StorageClient({});
      const result = await unconfiguredClient.list('any-prefix/');

      expect(result).toEqual([]);
    });
  });

  describe('listSubmissionArtifacts', () => {
    it('should list artifact filenames', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: 'submissions/sub-1/artifacts/output.json' },
          { Key: 'submissions/sub-1/artifacts/log.txt' },
        ],
      });

      const result = await client.listSubmissionArtifacts('sub-1');

      expect(result).toEqual(['output.json', 'log.txt']);
    });
  });

  describe('deleteAgentFiles', () => {
    it('should delete all agent files', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'agents/agent-1/source.js' },
            { Key: 'agents/agent-1/config.json' },
          ],
        })
        .mockResolvedValue({}); // for delete calls

      const result = await client.deleteAgentFiles('agent-1');

      expect(result).toBe(2);
    });
  });

  describe('deleteSubmissionArtifacts', () => {
    it('should delete all submission artifacts', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'submissions/sub-1/artifacts/out.json' },
          ],
        })
        .mockResolvedValue({}); // for delete call

      const result = await client.deleteSubmissionArtifacts('sub-1');

      expect(result).toBe(1);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on success', async () => {
      mockSend.mockResolvedValue({ Contents: [] });

      const result = await client.healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status on failure', async () => {
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const result = await client.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should return not configured status when client not available', async () => {
      const unconfiguredClient = new R2StorageClient({});

      const result = await unconfiguredClient.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('R2 client not configured');
    });
  });
});
