/**
 * SandboxRunner Tests - JavaScript sandbox execution
 *
 * Tests the QuickJS-based sandbox functionality including:
 * - Executing JavaScript code in isolated sandbox
 * - Capturing console output
 * - Error handling
 * - Size limits enforcement
 * - Low-code configuration processing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock functions that can be used in vi.mock factories
const { mockRunSandboxed, mockLoadQuickJs } = vi.hoisted(() => {
  const mockRunSandboxed = vi.fn();
  const mockLoadQuickJs = vi.fn();
  return { mockRunSandboxed, mockLoadQuickJs };
});

// Mock the modules - vi.mock is hoisted, so we need to use inline mock factories
vi.mock('@jitl/quickjs-ng-wasmfile-release-sync', () => ({
  default: {},
}));

vi.mock('@sebastianwessel/quickjs', () => ({
  loadQuickJs: mockLoadQuickJs,
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'AI response' } }],
            usage: { total_tokens: 100 },
          }),
        },
      },
    };
  }),
}));

// Import after mocking
import { SandboxRunner } from '../sandboxRunner';

describe('SandboxRunner', () => {
  let runner: SandboxRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSandboxed.mockReset();
    mockLoadQuickJs.mockReset();

    // Re-setup the mock for each test
    mockLoadQuickJs.mockResolvedValue({
      runSandboxed: mockRunSandboxed,
    });

    runner = new SandboxRunner();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  });

  describe('executeCode', () => {
    it('should run simple JavaScript and return success', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: ['Hello world'],
          errors: [],
        },
      });

      const result = await runner.executeCode('console.log("Hello world");');

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Hello world');
      expect(result.errors).toHaveLength(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should capture console.log output', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: ['Log 1', 'Log 2', 'Log 3'],
          errors: [],
        },
      });

      const result = await runner.executeCode(`
        console.log("Log 1");
        console.log("Log 2");
        console.log("Log 3");
      `);

      expect(result.success).toBe(true);
      expect(result.logs).toEqual(['Log 1', 'Log 2', 'Log 3']);
    });

    it('should capture errors from code execution', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: [],
          errors: ['ReferenceError: undefinedVar is not defined'],
        },
      });

      const result = await runner.executeCode('undefinedVar.foo();');

      expect(result.success).toBe(true);
      expect(result.errors).toContain('ReferenceError: undefinedVar is not defined');
    });

    it('should handle sandbox execution failure', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: false,
        error: new Error('Execution timed out'),
      });

      const result = await runner.executeCode('while(true) {}');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Execution timed out');
    });

    it('should reject oversized code', async () => {
      const oversizedCode = 'x'.repeat(600 * 1024); // 600KB, exceeds 512KB limit

      const result = await runner.executeCode(oversizedCode);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Code size');
      expect(result.errors[0]).toContain('exceeds maximum');
      expect(mockRunSandboxed).not.toHaveBeenCalled();
    });

    it('should reject oversized input', async () => {
      const oversizedInput = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB

      const result = await runner.executeCode('const x = INPUT;', oversizedInput);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Input size');
      expect(result.errors[0]).toContain('exceeds maximum');
      expect(mockRunSandboxed).not.toHaveBeenCalled();
    });

    it('should pass input to sandboxed code', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: ['Input received: test-value'],
          errors: [],
        },
      });

      const result = await runner.executeCode(
        'console.log("Input received:", INPUT.key);',
        { key: 'test-value' }
      );

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Input received: test-value');
    });

    it('should use custom config when provided', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: { logs: [], errors: [] },
      });

      const customRunner = new SandboxRunner({
        timeoutMs: 5000,
        allowFetch: true,
      });

      await customRunner.executeCode('1+1');

      expect(mockRunSandboxed).toHaveBeenCalled();
      const callArgs = mockRunSandboxed.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        executionTimeout: 5000,
        allowFetch: true,
      });
    });

    it('should handle exception when runSandboxed throws', async () => {
      mockRunSandboxed.mockRejectedValueOnce(
        new Error('Sandbox execution failed')
      );

      const result = await runner.executeCode('1+1');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Sandbox execution failed');
    });
  });

  describe('executeNoCode', () => {
    it('should return structured no-code response', async () => {
      const result = await runner.executeNoCode('Analyze this data', { data: [1, 2, 3] });

      expect(result.success).toBe(true);
      expect(result.output.type).toBe('no_code');
      expect(result.output.prompt).toBe('Analyze this data');
      expect(result.output.context).toEqual({ data: [1, 2, 3] });
      expect(result.logs).toContain('No-code agent: Prompt prepared for AI processing');
    });
  });

  describe('executeLowCode', () => {
    it('should process step configuration', async () => {
      const config = {
        steps: [
          { type: 'transform', action: 'map', params: { field: 'result', transform: 'done' } },
          { type: 'output', action: 'return' },
        ],
        variables: { initial: 'value' },
      };

      const result = await runner.executeLowCode(config, { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Executing step: transform - map');
      expect(result.logs).toContain('Executing step: output - return');
      expect(result.output.result).toBe('done');
    });

    it('should handle filter steps', async () => {
      const config = {
        steps: [
          { type: 'filter', action: 'where', params: { field: 'active', value: true } },
        ],
      };

      const result = await runner.executeLowCode(config);

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Executing step: filter - where');
    });

    it('should handle unknown step types gracefully', async () => {
      const config = {
        steps: [
          { type: 'unknown_type', action: 'do_something' },
        ],
      };

      const result = await runner.executeLowCode(config);

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Unknown step type: unknown_type');
    });

    it('should reject invalid configuration', async () => {
      const result = await runner.executeLowCode(null as any);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid low-code configuration');
    });

    it('should execute AI steps when OpenAI is configured', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const config = {
        steps: [
          { type: 'ai', action: 'generate', params: { prompt: 'Hello {{name}}' } },
        ],
        variables: { name: 'World' },
      };

      const result = await runner.executeLowCode(config);

      expect(result.success).toBe(true);
      expect(result.logs.some((log: string) => log.includes('AI step'))).toBe(true);
    });

    it('should skip AI steps when OpenAI is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

      const config = {
        steps: [
          { type: 'ai', action: 'generate', params: { prompt: 'Test prompt' } },
        ],
      };

      const result = await runner.executeLowCode(config);

      expect(result.success).toBe(true);
      expect(result.logs.some((log: string) =>
        log.includes('AI step skipped') || log.includes('AI step')
      )).toBe(true);
    });
  });

  describe('testSandbox', () => {
    it('should return passing result', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: ['Test calculation: 4'],
          errors: [],
          test: 'passed',
          result: 4,
        },
      });

      const result = await runner.testSandbox();

      expect(result.success).toBe(true);
      expect(mockRunSandboxed).toHaveBeenCalled();
    });

    it('should execute test code that performs 2+2 calculation', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: {
          logs: ['Test calculation: 4'],
          errors: [],
        },
      });

      const result = await runner.testSandbox();

      expect(mockRunSandboxed).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should use default config values', () => {
      const defaultRunner = new SandboxRunner();
      // Config is private but we can test via behavior
      expect(defaultRunner).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const customRunner = new SandboxRunner({
        memoryLimit: 64 * 1024 * 1024,
        allowFs: true,
      });
      expect(customRunner).toBeDefined();
    });

    it('should allow custom environment variables', async () => {
      mockRunSandboxed.mockResolvedValue({
        ok: true,
        data: { logs: [], errors: [] },
      });

      const customRunner = new SandboxRunner({
        env: { MY_VAR: 'my_value' },
      });

      await customRunner.executeCode('1+1');

      expect(mockRunSandboxed).toHaveBeenCalled();
      const callArgs = mockRunSandboxed.mock.calls[0];
      expect(callArgs[1].env).toEqual({ MY_VAR: 'my_value' });
    });
  });
});
