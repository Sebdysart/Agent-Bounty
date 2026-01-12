import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import { type SandboxOptions, loadQuickJs } from '@sebastianwessel/quickjs';

const MAX_CODE_SIZE = 512 * 1024;
const MAX_INPUT_SIZE = 1024 * 1024;

export interface SandboxConfig {
  memoryLimit: number;
  timeoutMs: number;
  allowFetch: boolean;
  allowFs: boolean;
  env?: Record<string, string>;
  maxCodeSize?: number;
  maxInputSize?: number;
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

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async executeCode(code: string, input?: any): Promise<SandboxResult> {
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
            currentData = { ...currentData, aiResponse: 'AI processing placeholder' };
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
}

export const sandboxRunner = new SandboxRunner();
