/**
 * VerificationService Tests - AI verification critical path
 *
 * Tests the core verification functionality including:
 * - Creating pending audits
 * - Running AI verification with OpenAI
 * - Parsing criteria checks from AI response
 * - Handling missing OpenAI gracefully
 * - Audit retrieval operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb, setMockResults, resetDbMocks } from './mocks/database';
import { mockOpenAI, resetOpenAIMocks, setMockOpenAIResponse } from './mocks/openai';

// Import the service after mocks are set up
import { verificationService } from '../verificationService';

describe('VerificationService', () => {
  beforeEach(() => {
    resetDbMocks();
    resetOpenAIMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('createAudit', () => {
    it('should create a pending audit', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'ai',
        status: 'pending',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockAudit]);

      const result = await verificationService.createAudit(100, 200);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
      expect(result.submissionId).toBe(100);
      expect(result.bountyId).toBe(200);
    });

    it('should use default auditorType of ai', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'ai',
        status: 'pending',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockAudit]);

      const result = await verificationService.createAudit(100, 200);

      expect(result.auditorType).toBe('ai');
    });

    it('should accept custom auditorType', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'human',
        status: 'pending',
        createdAt: new Date(),
      };
      setMockResults('insert', [mockAudit]);

      const result = await verificationService.createAudit(100, 200, 'human');

      expect(result.auditorType).toBe('human');
    });
  });

  describe('runAiVerification', () => {
    it('should call OpenAI for analysis', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'ai',
        status: 'pending',
        createdAt: new Date(),
      };
      const mockBounty = {
        id: 200,
        title: 'Test Bounty',
        description: 'Build a test feature',
        successMetrics: 'Feature works correctly',
        verificationCriteria: 'All tests pass',
      };
      const mockSubmission = {
        id: 100,
        output: 'Feature implemented successfully',
      };
      const completedAudit = {
        ...mockAudit,
        status: 'passed',
        overallScore: '85',
        confidence: '90',
        aiAnalysis: 'Submission meets all criteria',
      };

      // Mock select calls for audit, bounty, submission
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockBounty]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSubmission]),
          }),
        });

      // Mock the status update calls
      setMockResults('update', [completedAudit]);

      const result = await verificationService.runAiVerification(1);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Test Bounty'),
            }),
          ]),
          response_format: { type: 'json_object' },
        })
      );
      expect(result.status).toBe('passed');
    });

    it('should parse criteria checks from AI response', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'ai',
        status: 'pending',
        createdAt: new Date(),
      };
      const mockBounty = {
        id: 200,
        title: 'Test Bounty',
        description: 'Build feature',
        successMetrics: 'Works',
        verificationCriteria: 'Tests pass',
      };
      const mockSubmission = {
        id: 100,
        output: 'Done',
      };

      // Custom AI response with criteria checks
      const aiResponseContent = {
        criteriaChecks: [
          { criterion: 'Feature works', passed: true, score: 90, reasoning: 'All good' },
          { criterion: 'Tests pass', passed: true, score: 85, reasoning: 'All tests pass' },
        ],
        overallScore: 87,
        confidence: 92,
        summary: 'Excellent submission',
        recommendation: 'pass',
      };

      setMockOpenAIResponse({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: JSON.stringify(aiResponseContent) },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const completedAudit = {
        ...mockAudit,
        status: 'passed',
        criteriaChecks: JSON.stringify(aiResponseContent.criteriaChecks),
        overallScore: '87',
        confidence: '92',
        passedCriteria: 2,
        totalCriteria: 2,
        aiAnalysis: 'Excellent submission',
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockBounty]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSubmission]),
          }),
        });

      setMockResults('update', [completedAudit]);

      const result = await verificationService.runAiVerification(1);

      expect(result.passedCriteria).toBe(2);
      expect(result.totalCriteria).toBe(2);
      expect(result.overallScore).toBe('87');
      expect(result.confidence).toBe('92');
    });

    it('should handle missing OpenAI gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        auditorType: 'ai',
        status: 'pending',
        createdAt: new Date(),
      };
      const mockBounty = {
        id: 200,
        title: 'Test Bounty',
        description: 'Build feature',
      };
      const mockSubmission = {
        id: 100,
        output: 'Done',
      };
      const updatedAudit = {
        ...mockAudit,
        status: 'needs_review',
        aiAnalysis: 'AI verification unavailable - OpenAI API key not configured. Manual review required.',
        overallScore: '50',
        confidence: '0',
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockBounty]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSubmission]),
          }),
        });

      setMockResults('update', [updatedAudit]);

      const result = await verificationService.runAiVerification(1);

      expect(result.status).toBe('needs_review');
      expect(result.aiAnalysis).toContain('OpenAI API key not configured');
      expect(result.overallScore).toBe('50');
      expect(result.confidence).toBe('0');
    });

    it('should throw error when audit not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(verificationService.runAiVerification(999)).rejects.toThrow('Audit not found');
    });

    it('should throw error when bounty or submission not found', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        status: 'pending',
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // No bounty
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 100 }]),
          }),
        });

      setMockResults('update', [mockAudit]);

      await expect(verificationService.runAiVerification(1)).rejects.toThrow('Bounty or submission not found');
    });

    it('should set status to failed when score is below 40', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        status: 'pending',
      };
      const mockBounty = {
        id: 200,
        title: 'Test',
        description: 'Test',
      };
      const mockSubmission = {
        id: 100,
        output: 'Bad output',
      };

      const aiResponseContent = {
        criteriaChecks: [
          { criterion: 'Feature works', passed: false, score: 20, reasoning: 'Does not work' },
        ],
        overallScore: 25,
        confidence: 80,
        summary: 'Failed to meet criteria',
        recommendation: 'fail',
      };

      setMockOpenAIResponse({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: JSON.stringify(aiResponseContent) },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const failedAudit = {
        ...mockAudit,
        status: 'failed',
        overallScore: '25',
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockBounty]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSubmission]),
          }),
        });

      setMockResults('update', [failedAudit]);

      const result = await verificationService.runAiVerification(1);

      expect(result.status).toBe('failed');
    });

    it('should set status to needs_review for intermediate scores', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        status: 'pending',
      };
      const mockBounty = {
        id: 200,
        title: 'Test',
        description: 'Test',
      };
      const mockSubmission = {
        id: 100,
        output: 'Partial output',
      };

      const aiResponseContent = {
        criteriaChecks: [
          { criterion: 'Feature works', passed: true, score: 55, reasoning: 'Partially works' },
        ],
        overallScore: 55,
        confidence: 60,
        summary: 'Needs human review',
        recommendation: 'needs_review',
      };

      setMockOpenAIResponse({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: JSON.stringify(aiResponseContent) },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const reviewAudit = {
        ...mockAudit,
        status: 'needs_review',
        overallScore: '55',
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAudit]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockBounty]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSubmission]),
          }),
        });

      setMockResults('update', [reviewAudit]);

      const result = await verificationService.runAiVerification(1);

      expect(result.status).toBe('needs_review');
    });
  });

  describe('getAudit', () => {
    it('should return audit by ID', async () => {
      const mockAudit = {
        id: 1,
        submissionId: 100,
        bountyId: 200,
        status: 'passed',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockAudit]),
        }),
      });

      const result = await verificationService.getAudit(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.status).toBe('passed');
    });

    it('should return null for non-existent audit', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await verificationService.getAudit(999);

      expect(result).toBeNull();
    });
  });

  describe('getSubmissionAudits', () => {
    it('should return all audits for submission', async () => {
      const mockAudits = [
        { id: 1, submissionId: 100, status: 'passed', createdAt: new Date() },
        { id: 2, submissionId: 100, status: 'failed', createdAt: new Date() },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAudits),
          }),
        }),
      });

      const result = await verificationService.getSubmissionAudits(100);

      expect(result).toHaveLength(2);
      expect(result[0].submissionId).toBe(100);
    });

    it('should return empty array when no audits exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await verificationService.getSubmissionAudits(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('isOpenAIConfigured', () => {
    it('should return true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      expect(verificationService.isOpenAIConfigured()).toBe(true);
    });

    it('should return false when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;

      expect(verificationService.isOpenAIConfigured()).toBe(false);
    });
  });
});
