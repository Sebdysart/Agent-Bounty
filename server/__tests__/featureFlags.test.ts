/**
 * Tests for Feature Flag Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { featureFlags } from '../featureFlags';

describe('FeatureFlagService', () => {
  beforeEach(() => {
    featureFlags.reset();
  });

  describe('isEnabled', () => {
    it('should return false for unknown flags', () => {
      const result = featureFlags.isEnabled('UNKNOWN_FLAG');
      expect(result).toBe(false);
    });

    it('should return false for disabled default flags', () => {
      const result = featureFlags.isEnabled('USE_WASMTIME_SANDBOX');
      expect(result).toBe(false);
    });

    it('should return true when flag is enabled', () => {
      featureFlags.setEnabled('USE_WASMTIME_SANDBOX', true);
      featureFlags.setRolloutPercentage('USE_WASMTIME_SANDBOX', 100);
      const result = featureFlags.isEnabled('USE_WASMTIME_SANDBOX');
      expect(result).toBe(true);
    });

    it('should respect user overrides over flag state', () => {
      featureFlags.setEnabled('USE_UPSTASH_REDIS', false);
      featureFlags.setUserOverride('USE_UPSTASH_REDIS', 'user-123', true);

      expect(featureFlags.isEnabled('USE_UPSTASH_REDIS', 'user-123')).toBe(true);
      expect(featureFlags.isEnabled('USE_UPSTASH_REDIS', 'user-456')).toBe(false);
    });

    it('should return false user override when set to false', () => {
      featureFlags.setEnabled('USE_R2_STORAGE', true);
      featureFlags.setRolloutPercentage('USE_R2_STORAGE', 100);
      featureFlags.setUserOverride('USE_R2_STORAGE', 'user-123', false);

      expect(featureFlags.isEnabled('USE_R2_STORAGE', 'user-123')).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable a flag', () => {
      const result = featureFlags.setEnabled('USE_UPSTASH_KAFKA', true);
      expect(result).toBe(true);

      const flag = featureFlags.getFlag('USE_UPSTASH_KAFKA');
      expect(flag?.enabled).toBe(true);
    });

    it('should disable a flag', () => {
      featureFlags.setEnabled('USE_UPSTASH_KAFKA', true);
      const result = featureFlags.setEnabled('USE_UPSTASH_KAFKA', false);
      expect(result).toBe(true);

      const flag = featureFlags.getFlag('USE_UPSTASH_KAFKA');
      expect(flag?.enabled).toBe(false);
    });

    it('should return false for unknown flag', () => {
      const result = featureFlags.setEnabled('UNKNOWN_FLAG', true);
      expect(result).toBe(false);
    });
  });

  describe('setRolloutPercentage', () => {
    it('should set rollout percentage', () => {
      const result = featureFlags.setRolloutPercentage('USE_WASMTIME_SANDBOX', 50);
      expect(result).toBe(true);

      const flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');
      expect(flag?.rolloutPercentage).toBe(50);
    });

    it('should clamp percentage to 0-100 range', () => {
      featureFlags.setRolloutPercentage('USE_WASMTIME_SANDBOX', 150);
      let flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');
      expect(flag?.rolloutPercentage).toBe(100);

      featureFlags.setRolloutPercentage('USE_WASMTIME_SANDBOX', -50);
      flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should return false for unknown flag', () => {
      const result = featureFlags.setRolloutPercentage('UNKNOWN_FLAG', 50);
      expect(result).toBe(false);
    });
  });

  describe('rollout percentage behavior', () => {
    it('should return true for 100% rollout when enabled', () => {
      featureFlags.setEnabled('USE_R2_STORAGE', true);
      featureFlags.setRolloutPercentage('USE_R2_STORAGE', 100);

      expect(featureFlags.isEnabled('USE_R2_STORAGE')).toBe(true);
    });

    it('should return false for 0% rollout when enabled', () => {
      featureFlags.setEnabled('USE_R2_STORAGE', true);
      featureFlags.setRolloutPercentage('USE_R2_STORAGE', 0);

      expect(featureFlags.isEnabled('USE_R2_STORAGE')).toBe(false);
    });

    it('should provide consistent results for same user', () => {
      featureFlags.setEnabled('USE_UPSTASH_REDIS', true);
      featureFlags.setRolloutPercentage('USE_UPSTASH_REDIS', 50);

      const result1 = featureFlags.isEnabled('USE_UPSTASH_REDIS', 'consistent-user');
      const result2 = featureFlags.isEnabled('USE_UPSTASH_REDIS', 'consistent-user');

      expect(result1).toBe(result2);
    });
  });

  describe('setUserOverride', () => {
    it('should set user override', () => {
      const result = featureFlags.setUserOverride('USE_WASMTIME_SANDBOX', 'user-1', true);
      expect(result).toBe(true);

      const flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');
      expect(flag?.userOverrides.get('user-1')).toBe(true);
    });

    it('should return false for unknown flag', () => {
      const result = featureFlags.setUserOverride('UNKNOWN_FLAG', 'user-1', true);
      expect(result).toBe(false);
    });
  });

  describe('removeUserOverride', () => {
    it('should remove user override', () => {
      featureFlags.setUserOverride('USE_UPSTASH_KAFKA', 'user-1', true);

      const result = featureFlags.removeUserOverride('USE_UPSTASH_KAFKA', 'user-1');
      expect(result).toBe(true);

      const flag = featureFlags.getFlag('USE_UPSTASH_KAFKA');
      expect(flag?.userOverrides.has('user-1')).toBe(false);
    });

    it('should return false when no override exists', () => {
      const result = featureFlags.removeUserOverride('USE_UPSTASH_KAFKA', 'nonexistent-user');
      expect(result).toBe(false);
    });

    it('should return false for unknown flag', () => {
      const result = featureFlags.removeUserOverride('UNKNOWN_FLAG', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    it('should return all default flags', () => {
      const flags = featureFlags.getAllFlags();

      expect(flags).toHaveProperty('USE_WASMTIME_SANDBOX');
      expect(flags).toHaveProperty('USE_UPSTASH_REDIS');
      expect(flags).toHaveProperty('USE_UPSTASH_KAFKA');
      expect(flags).toHaveProperty('USE_R2_STORAGE');
    });

    it('should include flag metadata', () => {
      const flags = featureFlags.getAllFlags();

      expect(flags.USE_WASMTIME_SANDBOX).toEqual({
        enabled: false,
        rolloutPercentage: 0,
        description: 'Use Wasmtime for agent sandbox execution',
        overrideCount: 0
      });
    });

    it('should reflect updated state', () => {
      featureFlags.setEnabled('USE_R2_STORAGE', true);
      featureFlags.setRolloutPercentage('USE_R2_STORAGE', 75);
      featureFlags.setUserOverride('USE_R2_STORAGE', 'user-1', true);
      featureFlags.setUserOverride('USE_R2_STORAGE', 'user-2', false);

      const flags = featureFlags.getAllFlags();

      expect(flags.USE_R2_STORAGE.enabled).toBe(true);
      expect(flags.USE_R2_STORAGE.rolloutPercentage).toBe(75);
      expect(flags.USE_R2_STORAGE.overrideCount).toBe(2);
    });
  });

  describe('getFlag', () => {
    it('should return flag details', () => {
      const flag = featureFlags.getFlag('USE_UPSTASH_REDIS');

      expect(flag).toBeDefined();
      expect(flag?.name).toBe('USE_UPSTASH_REDIS');
      expect(flag?.description).toBe('Use Upstash Redis for caching and rate limiting');
    });

    it('should return undefined for unknown flag', () => {
      const flag = featureFlags.getFlag('UNKNOWN_FLAG');
      expect(flag).toBeUndefined();
    });
  });

  describe('evaluation logging', () => {
    it('should log flag evaluations', () => {
      featureFlags.clearEvaluationLog();
      featureFlags.isEnabled('USE_WASMTIME_SANDBOX');
      featureFlags.isEnabled('USE_UPSTASH_REDIS', 'user-123');

      const log = featureFlags.getEvaluationLog();

      expect(log.length).toBe(2);
      expect(log[0].flag).toBe('USE_WASMTIME_SANDBOX');
      expect(log[1].flag).toBe('USE_UPSTASH_REDIS');
      expect(log[1].userId).toBe('user-123');
    });

    it('should respect log limit', () => {
      featureFlags.clearEvaluationLog();

      const log = featureFlags.getEvaluationLog(1);
      expect(log.length).toBeLessThanOrEqual(1);
    });

    it('should clear evaluation log', () => {
      featureFlags.isEnabled('USE_WASMTIME_SANDBOX');
      featureFlags.clearEvaluationLog();

      const log = featureFlags.getEvaluationLog();
      expect(log.length).toBe(0);
    });

    it('should record correct reason for disabled flag', () => {
      featureFlags.clearEvaluationLog();
      featureFlags.isEnabled('USE_WASMTIME_SANDBOX');

      const log = featureFlags.getEvaluationLog();
      expect(log[0].reason).toBe('disabled');
    });

    it('should record correct reason for user override', () => {
      featureFlags.clearEvaluationLog();
      featureFlags.setUserOverride('USE_WASMTIME_SANDBOX', 'user-1', true);
      featureFlags.isEnabled('USE_WASMTIME_SANDBOX', 'user-1');

      const log = featureFlags.getEvaluationLog();
      expect(log[0].reason).toBe('user_override');
    });

    it('should record correct reason for unknown flag', () => {
      featureFlags.clearEvaluationLog();
      featureFlags.isEnabled('UNKNOWN_FLAG');

      const log = featureFlags.getEvaluationLog();
      expect(log[0].reason).toBe('default');
    });
  });

  describe('registerFlag', () => {
    it('should register new flag', () => {
      featureFlags.registerFlag('CUSTOM_FLAG', {
        enabled: true,
        rolloutPercentage: 50,
        description: 'A custom test flag'
      });

      const flag = featureFlags.getFlag('CUSTOM_FLAG');

      expect(flag).toBeDefined();
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(50);
      expect(flag?.description).toBe('A custom test flag');
    });

    it('should not overwrite existing flag', () => {
      featureFlags.registerFlag('USE_WASMTIME_SANDBOX', {
        enabled: true,
        rolloutPercentage: 100,
        description: 'Overwritten description'
      });

      const flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');

      expect(flag?.enabled).toBe(false);
      expect(flag?.description).toBe('Use Wasmtime for agent sandbox execution');
    });

    it('should use defaults for missing config', () => {
      featureFlags.registerFlag('MINIMAL_FLAG', {});

      const flag = featureFlags.getFlag('MINIMAL_FLAG');

      expect(flag?.enabled).toBe(false);
      expect(flag?.rolloutPercentage).toBe(0);
      expect(flag?.description).toBe('');
    });
  });

  describe('reset', () => {
    it('should reset all flags to defaults', () => {
      featureFlags.setEnabled('USE_WASMTIME_SANDBOX', true);
      featureFlags.setRolloutPercentage('USE_WASMTIME_SANDBOX', 100);
      featureFlags.setUserOverride('USE_WASMTIME_SANDBOX', 'user-1', true);
      featureFlags.registerFlag('CUSTOM_FLAG', { enabled: true });

      featureFlags.reset();

      const flag = featureFlags.getFlag('USE_WASMTIME_SANDBOX');
      expect(flag?.enabled).toBe(false);
      expect(flag?.rolloutPercentage).toBe(0);
      expect(flag?.userOverrides.size).toBe(0);

      expect(featureFlags.getFlag('CUSTOM_FLAG')).toBeUndefined();
    });

    it('should clear evaluation log on reset', () => {
      featureFlags.isEnabled('USE_WASMTIME_SANDBOX');
      featureFlags.reset();

      const log = featureFlags.getEvaluationLog();
      expect(log.length).toBe(0);
    });
  });

  describe('default flags', () => {
    it('should have all required default flags', () => {
      const flags = featureFlags.getAllFlags();

      const requiredFlags = [
        'USE_WASMTIME_SANDBOX',
        'USE_UPSTASH_REDIS',
        'USE_UPSTASH_KAFKA',
        'USE_R2_STORAGE'
      ];

      for (const flagName of requiredFlags) {
        expect(flags).toHaveProperty(flagName);
      }
    });

    it('should have all default flags disabled initially', () => {
      const flags = featureFlags.getAllFlags();

      for (const flag of Object.values(flags)) {
        expect(flag.enabled).toBe(false);
        expect(flag.rolloutPercentage).toBe(0);
      }
    });
  });
});
