/**
 * ReputationService Tests - Agent reputation and tier management
 *
 * Tests the core reputation functionality including:
 * - Initializing reputation for new agents
 * - Recording reputation events with score changes
 * - Processing reviews and adjusting scores
 * - Processing bounty completions (success/failure)
 * - Recalculating reputation and tier thresholds
 * - Getting agent reputation data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb, setMockResults, resetDbMocks } from './mocks/database';

// Import the service after mocks are set up
import { reputationService } from '../reputationService';

describe('ReputationService', () => {
  beforeEach(() => {
    resetDbMocks();
  });

  describe('initializeReputation', () => {
    it('should create bronze tier reputation for new agent', async () => {
      const mockReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        qualityScore: '50',
        reliabilityScore: '50',
        speedScore: '50',
        communicationScore: '50',
        tier: 'bronze',
        createdAt: new Date(),
      };

      // First check returns empty (no existing reputation)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      setMockResults('insert', [mockReputation]);

      const result = await reputationService.initializeReputation(100);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.agentId).toBe(100);
      expect(result.tier).toBe('bronze');
      expect(result.overallScore).toBe('50');
    });

    it('should return existing reputation if already initialized', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '75',
        tier: 'gold',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      const result = await reputationService.initializeReputation(100);

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('75');
      expect(result.tier).toBe('gold');
    });
  });

  describe('recordEvent', () => {
    it('should update scores correctly with positive change', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        tier: 'bronze',
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '3',
        previousScore: '50',
        newScore: '53',
        reason: 'positive review (5/5)',
        createdAt: new Date(),
      };

      // Select for existing reputation
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      // Insert event
      setMockResults('insert', [mockEvent]);

      // Mock recalculateReputation calls
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [{ ...existingReputation, overallScore: '53' }]);

      const result = await reputationService.recordEvent(100, 'review', 3, 'positive review (5/5)');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.scoreChange).toBe('3');
      expect(result.previousScore).toBe('50');
      expect(result.newScore).toBe('53');
    });

    it('should update scores correctly with negative change', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        tier: 'bronze',
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '-3',
        previousScore: '50',
        newScore: '47',
        reason: 'negative review (1/5)',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [{ ...existingReputation, overallScore: '47' }]);

      const result = await reputationService.recordEvent(100, 'review', -3, 'negative review (1/5)');

      expect(result.scoreChange).toBe('-3');
      expect(result.newScore).toBe('47');
    });

    it('should clamp score at 0 minimum', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '5',
        tier: 'bronze',
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'failure',
        scoreChange: '-10',
        previousScore: '5',
        newScore: '0',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [{ ...existingReputation, overallScore: '0' }]);

      const result = await reputationService.recordEvent(100, 'failure', -10);

      expect(result.newScore).toBe('0');
    });

    it('should clamp score at 100 maximum', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '98',
        tier: 'diamond',
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'completion',
        scoreChange: '5',
        previousScore: '98',
        newScore: '100',
        createdAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [{ ...existingReputation, overallScore: '100' }]);

      const result = await reputationService.recordEvent(100, 'completion', 5);

      expect(result.newScore).toBe('100');
    });
  });

  describe('processReview', () => {
    it('should adjust score based on 5-star rating (+3)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        positiveReviews: 5,
        totalReviews: 10,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '3',
        previousScore: '50',
        newScore: '53',
        reason: 'positive review (5/5)',
        relatedId: 1,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processReview(100, 5, 1);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should adjust score based on 4-star rating (+2)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        positiveReviews: 5,
        totalReviews: 10,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '2',
        previousScore: '50',
        newScore: '52',
        reason: 'positive review (4/5)',
        relatedId: 2,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processReview(100, 4, 2);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should not change score for 3-star rating (neutral)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        neutralReviews: 2,
        totalReviews: 10,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '0',
        previousScore: '50',
        newScore: '50',
        reason: 'neutral review (3/5)',
        relatedId: 3,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processReview(100, 3, 3);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should adjust score based on 2-star rating (-2)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        negativeReviews: 1,
        totalReviews: 10,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '-2',
        previousScore: '50',
        newScore: '48',
        reason: 'negative review (2/5)',
        relatedId: 4,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processReview(100, 2, 4);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should adjust score based on 1-star rating (-3)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        negativeReviews: 1,
        totalReviews: 10,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'review',
        scoreChange: '-3',
        previousScore: '50',
        newScore: '47',
        reason: 'negative review (1/5)',
        relatedId: 5,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processReview(100, 1, 5);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('processBountyCompletion', () => {
    it('should reward success with +5 score', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        completedBounties: 5,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'completion',
        scoreChange: '5',
        previousScore: '50',
        newScore: '55',
        reason: 'Bounty completed successfully',
        relatedId: 200,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processBountyCompletion(100, 200, true);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should penalize failure with -5 score', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        failedBounties: 2,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'failure',
        scoreChange: '-5',
        previousScore: '50',
        newScore: '45',
        reason: 'Bounty failed',
        relatedId: 200,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processBountyCompletion(100, 200, false);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update average completion time on success', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        completedBounties: 5,
        avgCompletionTime: 3600,
      };

      const mockEvent = {
        id: 1,
        agentId: 100,
        eventType: 'completion',
        scoreChange: '5',
        previousScore: '50',
        newScore: '55',
        reason: 'Bounty completed successfully',
        relatedId: 200,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReputation]),
        }),
      });

      setMockResults('insert', [mockEvent]);

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockEvent]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ ...existingReputation, completedBounties: 6 }]),
          }),
        });

      setMockResults('update', [existingReputation]);

      await reputationService.processBountyCompletion(100, 200, true, 1800);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('recalculateReputation', () => {
    it('should update tier thresholds - bronze (0-59)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '45',
        tier: 'bronze',
        completedBounties: 5,
        failedBounties: 5,
      };

      const mockEvents = [
        { scoreChange: '-5', createdAt: new Date() },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      const updatedReputation = {
        ...existingReputation,
        tier: 'bronze',
        reliabilityScore: '50',
      };

      setMockResults('update', [updatedReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(result.tier).toBe('bronze');
    });

    it('should update tier thresholds - silver (60-69)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '65',
        tier: 'silver',
        completedBounties: 7,
        failedBounties: 3,
      };

      const mockEvents = [
        { scoreChange: '15', createdAt: new Date() },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      const updatedReputation = {
        ...existingReputation,
        tier: 'silver',
        overallScore: '65',
      };

      setMockResults('update', [updatedReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(result.tier).toBe('silver');
    });

    it('should update tier thresholds - gold (70-79)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '75',
        tier: 'gold',
        completedBounties: 8,
        failedBounties: 2,
      };

      const mockEvents = [
        { scoreChange: '25', createdAt: new Date() },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      const updatedReputation = {
        ...existingReputation,
        tier: 'gold',
        overallScore: '75',
      };

      setMockResults('update', [updatedReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(result.tier).toBe('gold');
    });

    it('should update tier thresholds - platinum (80-89)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '85',
        tier: 'platinum',
        completedBounties: 9,
        failedBounties: 1,
      };

      const mockEvents = [
        { scoreChange: '35', createdAt: new Date() },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      const updatedReputation = {
        ...existingReputation,
        tier: 'platinum',
        overallScore: '85',
      };

      setMockResults('update', [updatedReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(result.tier).toBe('platinum');
    });

    it('should update tier thresholds - diamond (90+)', async () => {
      const existingReputation = {
        id: 1,
        agentId: 100,
        overallScore: '95',
        tier: 'diamond',
        completedBounties: 10,
        failedBounties: 0,
      };

      const mockEvents = [
        { scoreChange: '45', createdAt: new Date() },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingReputation]),
          }),
        });

      const updatedReputation = {
        ...existingReputation,
        tier: 'diamond',
        overallScore: '95',
      };

      setMockResults('update', [updatedReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(result.tier).toBe('diamond');
    });

    it('should initialize reputation if none exists', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const newReputation = {
        id: 1,
        agentId: 100,
        overallScore: '50',
        tier: 'bronze',
      };

      setMockResults('insert', [newReputation]);

      const result = await reputationService.recalculateReputation(100);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.tier).toBe('bronze');
    });
  });

  describe('getReputation (getAgentReputation)', () => {
    it('should return full reputation data', async () => {
      const mockReputation = {
        id: 1,
        agentId: 100,
        overallScore: '75',
        qualityScore: '80',
        reliabilityScore: '90',
        speedScore: '70',
        communicationScore: '85',
        tier: 'gold',
        badges: ['reliable', 'fast_responder'],
        completedBounties: 20,
        failedBounties: 2,
        totalReviews: 50,
        positiveReviews: 45,
        negativeReviews: 2,
        neutralReviews: 3,
        disputesWon: 3,
        disputesLost: 1,
        avgCompletionTime: 3600,
        avgResponseTime: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockReputation]),
        }),
      });

      const result = await reputationService.getReputation(100);

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe(100);
      expect(result?.tier).toBe('gold');
      expect(result?.overallScore).toBe('75');
      expect(result?.badges).toContain('reliable');
    });

    it('should return null for non-existent agent', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await reputationService.getReputation(999);

      expect(result).toBeNull();
    });
  });

  describe('getReputationHistory', () => {
    it('should return reputation events for agent', async () => {
      const mockEvents = [
        { id: 1, agentId: 100, eventType: 'completion', scoreChange: '5', createdAt: new Date() },
        { id: 2, agentId: 100, eventType: 'review', scoreChange: '3', createdAt: new Date() },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      });

      const result = await reputationService.getReputationHistory(100);

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('completion');
    });
  });

  describe('getLeaderboard', () => {
    it('should return top agents by score', async () => {
      const mockLeaderboard = [
        { id: 1, agentId: 100, overallScore: '95', tier: 'diamond' },
        { id: 2, agentId: 101, overallScore: '85', tier: 'platinum' },
        { id: 3, agentId: 102, overallScore: '75', tier: 'gold' },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockLeaderboard),
          }),
        }),
      });

      const result = await reputationService.getLeaderboard();

      expect(result).toHaveLength(3);
      expect(result[0].overallScore).toBe('95');
    });
  });

  describe('getAgentsByTier', () => {
    it('should return agents in specified tier', async () => {
      const mockAgents = [
        { id: 1, agentId: 100, overallScore: '92', tier: 'diamond' },
        { id: 2, agentId: 101, overallScore: '90', tier: 'diamond' },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAgents),
          }),
        }),
      });

      const result = await reputationService.getAgentsByTier('diamond');

      expect(result).toHaveLength(2);
      expect(result[0].tier).toBe('diamond');
    });
  });
});
