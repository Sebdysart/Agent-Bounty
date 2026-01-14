/**
 * Tests for R2 Cleanup Job
 * Mocks R2 storage and database to test orphan file detection and deletion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractAgentIdFromKey,
  extractSubmissionIdFromKey,
} from "../r2CleanupJob";

// Mock r2Storage
const mockR2Storage = {
  isAvailable: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../r2Storage", () => ({
  r2Storage: mockR2Storage,
}));

// Mock database
const mockDb = {
  select: vi.fn(),
};

vi.mock("../db", () => ({
  db: mockDb,
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  inArray: vi.fn((column, values) => ({ column, values })),
}));

// Mock schema
vi.mock("@shared/schema", () => ({
  agentUploads: { id: "id" },
  submissions: { id: "id" },
}));

describe("R2 Cleanup Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("extractAgentIdFromKey", () => {
    it("should extract agent ID from valid key", () => {
      expect(extractAgentIdFromKey("agents/123/source.js")).toBe("123");
      expect(extractAgentIdFromKey("agents/456/config.json")).toBe("456");
      expect(extractAgentIdFromKey("agents/789/")).toBe("789");
    });

    it("should return null for invalid keys", () => {
      expect(extractAgentIdFromKey("submissions/123/file.js")).toBeNull();
      expect(extractAgentIdFromKey("agents/abc/source.js")).toBeNull();
      expect(extractAgentIdFromKey("other/123/file.js")).toBeNull();
      expect(extractAgentIdFromKey("")).toBeNull();
    });
  });

  describe("extractSubmissionIdFromKey", () => {
    it("should extract submission ID from valid key", () => {
      expect(extractSubmissionIdFromKey("submissions/123/artifacts/output.json")).toBe("123");
      expect(extractSubmissionIdFromKey("submissions/456/file.txt")).toBe("456");
      expect(extractSubmissionIdFromKey("submissions/789/")).toBe("789");
    });

    it("should return null for invalid keys", () => {
      expect(extractSubmissionIdFromKey("agents/123/source.js")).toBeNull();
      expect(extractSubmissionIdFromKey("submissions/abc/file.js")).toBeNull();
      expect(extractSubmissionIdFromKey("other/123/file.js")).toBeNull();
      expect(extractSubmissionIdFromKey("")).toBeNull();
    });
  });

  describe("runR2CleanupJob", () => {
    it("should return early when R2 is not configured", async () => {
      mockR2Storage.isAvailable.mockReturnValue(false);

      // Re-import to get fresh module with mocks
      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("R2 storage is not configured");
      expect(mockR2Storage.list).not.toHaveBeenCalled();
    });

    it("should handle empty R2 storage", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list.mockResolvedValue([]);

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob();

      expect(result.success).toBe(true);
      expect(result.orphanedAgentFiles).toBe(0);
      expect(result.orphanedSubmissionFiles).toBe(0);
      expect(result.deletedAgentFiles).toBe(0);
      expect(result.deletedSubmissionFiles).toBe(0);
    });

    it("should identify orphaned agent files", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list
        .mockResolvedValueOnce([
          "agents/1/source.js",
          "agents/2/source.js",
          "agents/3/source.js",
        ])
        .mockResolvedValueOnce([]);

      // Mock DB to return only agents 1 and 2 exist
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        }),
      });

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob({ dryRun: true });

      expect(result.orphanedAgentFiles).toBe(1); // Agent 3 is orphaned
      expect(result.deletedAgentFiles).toBe(0); // Dry run, no deletion
    });

    it("should delete orphaned files when not in dry run mode", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list
        .mockResolvedValueOnce(["agents/999/source.js"])
        .mockResolvedValueOnce([]);
      mockR2Storage.delete.mockResolvedValue(true);

      // Mock DB to return empty (no matching agents)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob({ dryRun: false });

      expect(result.orphanedAgentFiles).toBe(1);
      expect(result.deletedAgentFiles).toBe(1);
      expect(mockR2Storage.delete).toHaveBeenCalledWith("agents/999/source.js");
    });

    it("should handle delete failures gracefully", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list
        .mockResolvedValueOnce(["agents/999/source.js"])
        .mockResolvedValueOnce([]);
      mockR2Storage.delete.mockResolvedValue(false);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob({ dryRun: false });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.deletedAgentFiles).toBe(0);
    });

    it("should respect maxFilesToDelete limit", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list
        .mockResolvedValueOnce([
          "agents/1/source.js",
          "agents/2/source.js",
          "agents/3/source.js",
          "agents/4/source.js",
        ])
        .mockResolvedValueOnce([]);
      mockR2Storage.delete.mockResolvedValue(true);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob({ dryRun: false, maxFilesToDelete: 2 });

      // With maxFilesToDelete=2, only 1 agent file should be deleted (half the limit)
      expect(result.deletedAgentFiles).toBeLessThanOrEqual(1);
    });

    it("should track duration", async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.list.mockResolvedValue([]);

      const { runR2CleanupJob } = await import("../r2CleanupJob");
      const result = await runR2CleanupJob();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
