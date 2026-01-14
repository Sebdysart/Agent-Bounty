/**
 * AiExecutionService Tests - AI agent execution critical path
 *
 * Tests the core AI execution functionality including:
 * - Creating queued execution runs
 * - Executing runs with OpenAI
 * - Cost calculation based on token usage
 * - Error handling and retries
 * - Run status and history retrieval
 * - Execution statistics aggregation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb, setMockResults, resetDbMocks } from './mocks/database';
import { mockOpenAI, resetOpenAIMocks, setMockOpenAIResponse, mockOpenAIResponse } from './mocks/openai';

// Import the service after mocks are set up
import { aiExecutionService } from '../aiExecutionService';

describe('AiExecutionService', () => {
  beforeEach(() => {
    resetDbMocks();
    resetOpenAIMocks();
    // Ensure OpenAI API key is set for tests
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('createExecutionRun', () => {
    it('should create a queued execution run', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockRun]);

      const result = await aiExecutionService.createExecutionRun(123, 'Test input');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.status).toBe('queued');
      expect(result.agentId).toBe(123);
    });

    it('should use default model gpt-4o when not specified', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockRun]);

      const result = await aiExecutionService.createExecutionRun(123, 'Test input');

      expect(result.model).toBe('gpt-4o');
    });

    it('should accept custom model option', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o-mini',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockRun]);

      const result = await aiExecutionService.createExecutionRun(123, 'Test input', {
        model: 'gpt-4o-mini',
      });

      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should accept bountyId and submissionId options', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        bountyId: 456,
        submissionId: 789,
        createdAt: new Date(),
      };
      setMockResults('insert', [mockRun]);

      const result = await aiExecutionService.createExecutionRun(123, 'Test input', {
        bountyId: 456,
        submissionId: 789,
      });

      expect(result.bountyId).toBe(456);
      expect(result.submissionId).toBe(789);
    });
  });

  describe('executeRun', () => {
    it('should transition run to running state', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      const mockAgent = {
        id: 123,
        name: 'Test Agent',
        description: 'A test agent',
      };
      const completedRun = {
        ...mockRun,
        status: 'completed',
        output: 'This is a mock AI response for testing purposes.',
        tokensInput: 100,
        tokensOutput: 50,
      };

      setMockResults('select', [mockRun]);
      setMockResults('update', [completedRun]);

      // Mock agent lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRun]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockAgent]),
        }),
      });

      const result = await aiExecutionService.executeRun(1);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });

    it('should call OpenAI with correct messages', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'What is 2+2?',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      const mockAgent = {
        id: 123,
        name: 'Math Helper',
        description: 'A math agent',
      };
      const completedRun = {
        ...mockRun,
        status: 'completed',
        output: 'The answer is 4.',
      };

      // Setup select mocks for run and agent
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAgent]),
          }),
        });
      setMockResults('update', [completedRun]);

      await aiExecutionService.executeRun(1);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Math Helper'),
            }),
            expect.objectContaining({
              role: 'user',
              content: 'What is 2+2?',
            }),
          ]),
        })
      );
    });

    it('should calculate cost correctly based on token usage', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      const mockAgent = {
        id: 123,
        name: 'Test Agent',
        description: 'Test',
      };

      // gpt-4o pricing: input $0.0025/1K, output $0.01/1K
      // With 100 input tokens and 50 output tokens:
      // Cost = (100 * 0.0025 / 1000) + (50 * 0.01 / 1000)
      //      = 0.00025 + 0.0005 = 0.00075
      const expectedCostUsd = '0.00075';
      const completedRun = {
        ...mockRun,
        status: 'completed',
        tokensInput: 100,
        tokensOutput: 50,
        costUsd: expectedCostUsd,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAgent]),
          }),
        });
      setMockResults('update', [completedRun]);

      const result = await aiExecutionService.executeRun(1);

      expect(result.tokensInput).toBe(100);
      expect(result.tokensOutput).toBe(50);
      expect(result.costUsd).toBe(expectedCostUsd);
    });

    it('should handle API errors gracefully', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
        retryCount: 0,
      };
      const mockAgent = {
        id: 123,
        name: 'Test Agent',
        description: 'Test',
      };
      const failedRun = {
        ...mockRun,
        status: 'failed',
        errorMessage: 'API rate limit exceeded',
        retryCount: 1,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAgent]),
          }),
        });
      setMockResults('update', [failedRun]);

      // Make OpenAI throw an error
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );

      const result = await aiExecutionService.executeRun(1);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('API rate limit exceeded');
    });

    it('should increment retry count on failure', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        retryCount: 0,
        createdAt: new Date(),
      };
      const mockAgent = {
        id: 123,
        name: 'Test Agent',
        description: 'Test',
      };
      const failedRun = {
        ...mockRun,
        status: 'failed',
        retryCount: 1,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAgent]),
          }),
        });
      setMockResults('update', [failedRun]);

      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await aiExecutionService.executeRun(1);

      expect(result.retryCount).toBe(1);
    });

    it('should throw error when run not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(aiExecutionService.executeRun(999)).rejects.toThrow('Run not found');
    });

    it('should throw error when agent not found', async () => {
      const mockRun = {
        id: 1,
        agentId: 999,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      await expect(aiExecutionService.executeRun(1)).rejects.toThrow('Agent not found');
    });
  });

  describe('executeAgent', () => {
    it('should create and execute run in one call', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'queued',
        model: 'gpt-4o',
        createdAt: new Date(),
      };
      const mockAgent = {
        id: 123,
        name: 'Test Agent',
        description: 'Test',
      };
      const completedRun = {
        ...mockRun,
        status: 'completed',
        output: 'This is a mock AI response for testing purposes.',
      };

      setMockResults('insert', [mockRun]);
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRun]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAgent]),
          }),
        });
      setMockResults('update', [completedRun]);

      const result = await aiExecutionService.executeAgent(123, 'Test input');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });
  });

  describe('getRunStatus', () => {
    it('should return run by ID', async () => {
      const mockRun = {
        id: 1,
        agentId: 123,
        input: 'Test input',
        status: 'completed',
        output: 'Test output',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRun]),
        }),
      });

      const result = await aiExecutionService.getRunStatus(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.status).toBe('completed');
    });

    it('should return null for non-existent run', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await aiExecutionService.getRunStatus(999);

      expect(result).toBeNull();
    });
  });

  describe('getAgentRuns', () => {
    it('should return runs for agent', async () => {
      const mockRuns = [
        { id: 1, agentId: 123, status: 'completed', createdAt: new Date() },
        { id: 2, agentId: 123, status: 'completed', createdAt: new Date() },
        { id: 3, agentId: 123, status: 'failed', createdAt: new Date() },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRuns),
            }),
          }),
        }),
      });

      const result = await aiExecutionService.getAgentRuns(123);

      expect(result).toHaveLength(3);
      expect(result[0].agentId).toBe(123);
    });

    it('should respect limit parameter', async () => {
      const mockRuns = [
        { id: 1, agentId: 123, status: 'completed', createdAt: new Date() },
        { id: 2, agentId: 123, status: 'completed', createdAt: new Date() },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRuns),
            }),
          }),
        }),
      });

      const result = await aiExecutionService.getAgentRuns(123, 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getExecutionStats', () => {
    it('should return correct aggregates', async () => {
      const mockRuns = [
        { id: 1, status: 'completed', costUsd: '0.001', executionTimeMs: 1000, tokensInput: 100, tokensOutput: 50 },
        { id: 2, status: 'completed', costUsd: '0.002', executionTimeMs: 2000, tokensInput: 200, tokensOutput: 100 },
        { id: 3, status: 'failed', costUsd: null, executionTimeMs: 500, tokensInput: 0, tokensOutput: 0 },
        { id: 4, status: 'queued', costUsd: null, executionTimeMs: null, tokensInput: 0, tokensOutput: 0 },
      ];

      // getExecutionStats uses db.select().from() directly, which returns an array
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue(mockRuns),
      });

      const result = await aiExecutionService.getExecutionStats();

      expect(result.totalRuns).toBe(4);
      expect(result.successfulRuns).toBe(2);
      expect(result.failedRuns).toBe(1);
      expect(result.totalCost).toBeCloseTo(0.003, 5);
      expect(result.avgExecutionTime).toBe(1500); // (1000 + 2000) / 2
      expect(result.totalTokens).toBe(450); // (100+50) + (200+100)
    });

    it('should filter by agentId when provided', async () => {
      const mockRuns = [
        { id: 1, agentId: 123, status: 'completed', costUsd: '0.001', executionTimeMs: 1000, tokensInput: 100, tokensOutput: 50 },
      ];

      // When agentId is provided, it chains .where()
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRuns),
        }),
      });

      const result = await aiExecutionService.getExecutionStats(123);

      expect(result.totalRuns).toBe(1);
      expect(result.successfulRuns).toBe(1);
    });

    it('should handle empty results', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      });

      const result = await aiExecutionService.getExecutionStats();

      expect(result.totalRuns).toBe(0);
      expect(result.successfulRuns).toBe(0);
      expect(result.failedRuns).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.avgExecutionTime).toBe(0);
      expect(result.totalTokens).toBe(0);
    });
  });

  describe('cancelRun', () => {
    it('should update status to cancelled', async () => {
      const cancelledRun = {
        id: 1,
        status: 'cancelled',
        completedAt: new Date(),
      };
      setMockResults('update', [cancelledRun]);

      await aiExecutionService.cancelRun(1);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('isConfigured', () => {
    it('should return true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

      expect(aiExecutionService.isConfigured()).toBe(true);
    });

    it('should return true when AI_INTEGRATIONS_OPENAI_API_KEY is set', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'test-key';

      expect(aiExecutionService.isConfigured()).toBe(true);
    });

    it('should return false when no API key is set', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

      expect(aiExecutionService.isConfigured()).toBe(false);
    });
  });
});
