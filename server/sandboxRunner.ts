import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import { type SandboxOptions, loadQuickJs } from '@sebastianwessel/quickjs';
import OpenAI from "openai";
import { WasmtimeSandbox, type WasmtimeSandboxConfig, BOUNTY_TIERS } from './wasmtimeSandbox';

const MAX_CODE_SIZE = 512 * 1024;

// Feature flag for Wasmtime backend - can be toggled via environment variable
const USE_WASMTIME_SANDBOX = process.env.USE_WASMTIME_SANDBOX === 'true';

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}
const MAX_INPUT_SIZE = 1024 * 1024;

export interface SandboxConfig {
  memoryLimit: number;
  timeoutMs: number;
  allowFetch: boolean;
  allowFs: boolean;
  env?: Record<string, string>;
  maxCodeSize?: number;
  maxInputSize?: number;
  tier?: string;  // Bounty tier for Wasmtime backend
  useWasmtime?: boolean;  // Override feature flag per-instance
}

export interface SandboxResult {
  success: boolean;
  output: any;
  logs: string[];
  errors: string[];
  executionTimeMs: number;
  memoryUsedBytes?: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
  memoryLimit: 128 * 1024 * 1024,
  timeoutMs: 30000,
  allowFetch: false,
  allowFs: false,
  env: {},
};

let quickJsInstance: Awaited<ReturnType<typeof loadQuickJs>> | null = null;

async function getQuickJs() {
  if (!quickJsInstance) {
    quickJsInstance = await loadQuickJs(variant);
  }
  return quickJsInstance;
}

export class SandboxRunner {
  private config: SandboxConfig;
  private logs: string[] = [];
  private errors: string[] = [];
  private wasmtimeSandbox: WasmtimeSandbox | null = null;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize Wasmtime sandbox if enabled
    if (this.shouldUseWasmtime()) {
      this.wasmtimeSandbox = new WasmtimeSandbox({
        memoryLimit: this.config.memoryLimit,
        timeoutMs: this.config.timeoutMs,
        allowFetch: this.config.allowFetch,
        allowFs: this.config.allowFs,
        env: this.config.env,
        tier: this.config.tier,
      });
    }
  }

  /**
   * Determine whether to use Wasmtime backend
   */
  private shouldUseWasmtime(): boolean {
    // Per-instance override takes precedence
    if (this.config.useWasmtime !== undefined) {
      return this.config.useWasmtime;
    }
    // Fall back to global feature flag
    return USE_WASMTIME_SANDBOX;
  }

  async executeCode(code: string, input?: any): Promise<SandboxResult> {
    // Route to Wasmtime backend if enabled
    if (this.shouldUseWasmtime()) {
      return this.executeWithWasmtime(code, input);
    }
    // Fall back to QuickJS
    return this.executeWithQuickJS(code, input);
  }

  /**
   * Execute code using the Wasmtime backend
   */
  private async executeWithWasmtime(code: string, input?: any): Promise<SandboxResult> {
    if (!this.wasmtimeSandbox) {
      this.wasmtimeSandbox = new WasmtimeSandbox({
        memoryLimit: this.config.memoryLimit,
        timeoutMs: this.config.timeoutMs,
        allowFetch: this.config.allowFetch,
        allowFs: this.config.allowFs,
        env: this.config.env,
        tier: this.config.tier,
      });
    }
    return this.wasmtimeSandbox.executeCode(code, input);
  }

  /**
   * Execute code using the QuickJS backend (original implementation)
   */
  private async executeWithQuickJS(code: string, input?: any): Promise<SandboxResult> {
    const startTime = Date.now();
    this.logs = [];
    this.errors = [];

    const maxCodeSize = this.config.maxCodeSize || MAX_CODE_SIZE;
    const maxInputSize = this.config.maxInputSize || MAX_INPUT_SIZE;

    if (code.length > maxCodeSize) {
      return {
        success: false,
        output: null,
        logs: [],
        errors: [`Code size (${code.length} bytes) exceeds maximum allowed (${maxCodeSize} bytes)`],
        executionTimeMs: Date.now() - startTime,
      };
    }

    const inputStr = input ? JSON.stringify(input) : '';
    if (inputStr.length > maxInputSize) {
      return {
        success: false,
        output: null,
        logs: [],
        errors: [`Input size (${inputStr.length} bytes) exceeds maximum allowed (${maxInputSize} bytes)`],
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const { runSandboxed } = await getQuickJs();

      const options: SandboxOptions = {
        allowFetch: this.config.allowFetch,
        allowFs: this.config.allowFs,
        env: this.config.env || {},
        executionTimeout: this.config.timeoutMs,
      };

      const wrappedCode = `
        const INPUT = ${JSON.stringify(input || null)};

        const logs = [];
        const errors = [];

        const originalLog = console.log;
        const originalError = console.error;

        console.log = (...args) => {
          logs.push(args.map(a => String(a)).join(' '));
        };
        console.error = (...args) => {
          errors.push(args.map(a => String(a)).join(' '));
        };

        try {
          ${code}
        } catch (e) {
          errors.push(String(e));
        }

        export default { logs, errors };
      `;

      const result = await runSandboxed(
        async ({ evalCode }) => evalCode(wrappedCode),
        options
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.ok) {
        const data = result.data as any;
        return {
          success: true,
          output: data,
          logs: data?.logs || this.logs,
          errors: data?.errors || this.errors,
          executionTimeMs,
        };
      } else {
        const errorMsg = result.error instanceof Error
          ? result.error.message
          : typeof result.error === 'object'
            ? JSON.stringify(result.error)
            : String(result.error);
        return {
          success: false,
          output: null,
          logs: this.logs,
          errors: [...this.errors, errorMsg],
          executionTimeMs,
        };
      }
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object'
          ? JSON.stringify(error)
          : String(error);
      return {
        success: false,
        output: null,
        logs: this.logs,
        errors: [...this.errors, errorMsg || 'Unknown error'],
        executionTimeMs,
      };
    }
  }

  async executeNoCode(prompt: string, context?: any): Promise<SandboxResult> {
    const startTime = Date.now();
    
    return {
      success: true,
      output: {
        type: 'no_code',
        prompt,
        context,
        message: 'No-code execution routes to OpenAI integration',
      },
      logs: ['No-code agent: Prompt prepared for AI processing'],
      errors: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  async executeLowCode(config: any, input?: any): Promise<SandboxResult> {
    const startTime = Date.now();
    this.logs = [];
    this.errors = [];

    try {
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid low-code configuration');
      }

      const { steps = [], variables = {} } = config;
      let currentData = { ...variables, input };

      for (const step of steps) {
        const { type, action, params } = step;
        this.logs.push(`Executing step: ${type} - ${action}`);

        switch (type) {
          case 'transform':
            if (action === 'map' && params?.field && params?.transform) {
              currentData[params.field] = params.transform;
            }
            break;
          case 'filter':
            this.logs.push(`Filter applied: ${JSON.stringify(params)}`);
            break;
          case 'output':
            this.logs.push(`Output: ${JSON.stringify(currentData)}`);
            break;
          case 'ai':
            this.logs.push(`AI step: ${params?.prompt || 'No prompt'}`);
            // Actually execute AI call if OpenAI is configured
            const openai = getOpenAIClient();
            if (openai && params?.prompt) {
              try {
                const aiResponse = await openai.chat.completions.create({
                  model: params?.model || "gpt-4o-mini",
                  messages: [
                    { role: "system", content: params?.systemPrompt || "You are a helpful assistant." },
                    { role: "user", content: typeof params.prompt === 'string' 
                      ? params.prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => currentData[key] || '')
                      : JSON.stringify(params.prompt) 
                    }
                  ],
                  max_tokens: params?.maxTokens || 1024,
                });
                currentData = { 
                  ...currentData, 
                  aiResponse: aiResponse.choices[0]?.message?.content || '',
                  aiUsage: aiResponse.usage
                };
                this.logs.push(`AI response received (${aiResponse.usage?.total_tokens || 0} tokens)`);
              } catch (aiError: any) {
                this.errors.push(`AI execution failed: ${aiError.message}`);
                currentData = { ...currentData, aiResponse: null, aiError: aiError.message };
              }
            } else {
              this.logs.push('AI step skipped: OpenAI not configured or no prompt provided');
              currentData = { ...currentData, aiResponse: null };
            }
            break;
          default:
            this.logs.push(`Unknown step type: ${type}`);
        }
      }

      return {
        success: true,
        output: currentData,
        logs: this.logs,
        errors: this.errors,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: null,
        logs: this.logs,
        errors: [error.message],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  async testSandbox(): Promise<SandboxResult> {
    const testCode = `
      const result = 2 + 2;
      console.log('Test calculation:', result);
      ({ test: 'passed', result });
    `;
    return this.executeCode(testCode);
  }

  /**
   * Get the current backend type being used
   */
  getBackendType(): 'wasmtime' | 'quickjs' {
    return this.shouldUseWasmtime() ? 'wasmtime' : 'quickjs';
  }

  /**
   * Get configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Check if Wasmtime backend is enabled
   */
  static isWasmtimeEnabled(): boolean {
    return USE_WASMTIME_SANDBOX;
  }
}

// Re-export Wasmtime types and constants for convenience
export { BOUNTY_TIERS, WasmtimeSandbox };
export type { WasmtimeSandboxConfig };

export const sandboxRunner = new SandboxRunner();
