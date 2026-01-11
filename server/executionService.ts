import PgBoss from 'pg-boss';
import { db } from './db';
import { agentExecutions, agents, agentUploads } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { SandboxRunner, SandboxResult } from './sandboxRunner';
import OpenAI from 'openai';

const EXECUTION_QUEUE = 'agent-execution';

interface ExecutionJob {
  executionId: number;
  agentId: number;
  bountyId: number;
  submissionId: number;
  input: string;
  agentType: 'no_code' | 'low_code' | 'full_code';
  agentConfig?: string | null;
}

class ExecutionService {
  private boss: PgBoss | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.warn('DATABASE_URL not set, execution service disabled');
        return;
      }

      this.boss = new PgBoss(connectionString);
      
      this.boss.on('error', (error) => {
        console.error('PgBoss error:', error);
      });

      await this.boss.start();
      
      await this.boss.work(EXECUTION_QUEUE, async (jobs) => {
        for (const job of jobs) {
          await this.processJob(job.data as ExecutionJob);
        }
      });

      this.isInitialized = true;
      console.log('Execution service initialized');
    } catch (error) {
      console.error('Failed to initialize execution service:', error);
    }
  }

  async queueExecution(params: {
    submissionId: number;
    agentId: number;
    bountyId: number;
    input: string;
  }): Promise<number> {
    const agent = await db.select().from(agents).where(eq(agents.id, params.agentId)).limit(1);
    if (!agent[0]) throw new Error('Agent not found');

    const agentUpload = await db.select().from(agentUploads)
      .where(eq(agentUploads.linkedAgentId, params.agentId))
      .limit(1);

    const agentType = agentUpload[0]?.uploadType || 'no_code';
    const agentConfig = agentUpload[0]?.configJson || agentUpload[0]?.prompt || null;

    const [execution] = await db.insert(agentExecutions).values({
      submissionId: params.submissionId,
      agentId: params.agentId,
      bountyId: params.bountyId,
      input: params.input,
      status: 'queued',
      priority: 5,
      timeoutMs: 30000,
    }).returning();

    if (this.boss) {
      await this.boss.send(EXECUTION_QUEUE, {
        executionId: execution.id,
        agentId: params.agentId,
        bountyId: params.bountyId,
        submissionId: params.submissionId,
        input: params.input,
        agentType,
        agentConfig,
      } as ExecutionJob, {
        priority: 5,
        retryLimit: 3,
        retryDelay: 1000,
      });
    } else {
      setTimeout(() => this.processJob({
        executionId: execution.id,
        agentId: params.agentId,
        bountyId: params.bountyId,
        submissionId: params.submissionId,
        input: params.input,
        agentType: agentType as 'no_code' | 'low_code' | 'full_code',
        agentConfig,
      }), 100);
    }

    return execution.id;
  }

  private async processJob(job: ExecutionJob): Promise<void> {
    const { executionId, agentType, agentConfig, input } = job;
    const startTime = Date.now();

    try {
      await db.update(agentExecutions)
        .set({ status: 'initializing', startedAt: new Date() })
        .where(eq(agentExecutions.id, executionId));

      await db.update(agentExecutions)
        .set({ status: 'running' })
        .where(eq(agentExecutions.id, executionId));

      let result: SandboxResult;
      const sandbox = new SandboxRunner({
        memoryLimit: 128 * 1024 * 1024,
        timeoutMs: 30000,
        allowFetch: false,
        allowFs: false,
      });

      const parsedInput = input ? JSON.parse(input) : null;

      switch (agentType) {
        case 'no_code':
          result = await this.executeNoCodeAgent(agentConfig || undefined, parsedInput);
          break;
        case 'low_code':
          const config = agentConfig ? JSON.parse(agentConfig) : {};
          result = await sandbox.executeLowCode(config, parsedInput);
          break;
        case 'full_code':
          const code = agentConfig || 'export default null;';
          result = await sandbox.executeCode(code, parsedInput);
          break;
        default:
          result = await sandbox.executeNoCode('Unknown agent type', parsedInput);
      }

      const executionTimeMs = Date.now() - startTime;

      await db.update(agentExecutions)
        .set({
          status: result.success ? 'completed' : 'failed',
          output: JSON.stringify(result.output),
          logs: result.logs.join('\n'),
          errorMessage: result.errors.length > 0 ? result.errors.join('\n') : null,
          executionTimeMs,
          completedAt: new Date(),
          resourceUsage: JSON.stringify({ memoryUsedBytes: result.memoryUsedBytes }),
        })
        .where(eq(agentExecutions.id, executionId));

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      
      await db.update(agentExecutions)
        .set({
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          executionTimeMs,
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, executionId));
    }
  }

  private async executeNoCodeAgent(configStr: string | undefined, input: any): Promise<SandboxResult> {
    const startTime = Date.now();
    
    try {
      let prompt = 'Process the following input:';
      
      if (configStr) {
        try {
          const config = JSON.parse(configStr);
          prompt = config.prompt || config.systemPrompt || prompt;
        } catch {
          prompt = configStr;
        }
      }
      
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        return {
          success: true,
          output: {
            type: 'no_code_simulation',
            prompt,
            input,
            simulatedResponse: 'OpenAI integration not configured. This is a simulated response.',
          },
          logs: ['No-code agent executed (simulation mode - OpenAI not configured)'],
          errors: [],
          executionTimeMs: Date.now() - startTime,
        };
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(input) },
        ],
        max_tokens: 2000,
      });

      const aiResponse = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        success: true,
        output: {
          type: 'no_code',
          response: aiResponse,
          tokensUsed,
        },
        logs: [`No-code agent executed successfully. Tokens used: ${tokensUsed}`],
        errors: [],
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: null,
        logs: [],
        errors: [error.message],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  async getExecution(id: number) {
    const [execution] = await db.select().from(agentExecutions)
      .where(eq(agentExecutions.id, id));
    return execution;
  }

  async getExecutionsBySubmission(submissionId: number) {
    return db.select().from(agentExecutions)
      .where(eq(agentExecutions.submissionId, submissionId))
      .orderBy(desc(agentExecutions.queuedAt));
  }

  async getExecutionsByAgent(agentId: number) {
    return db.select().from(agentExecutions)
      .where(eq(agentExecutions.agentId, agentId))
      .orderBy(desc(agentExecutions.queuedAt));
  }

  async cancelExecution(id: number): Promise<boolean> {
    const [execution] = await db.select().from(agentExecutions)
      .where(eq(agentExecutions.id, id));
    
    if (!execution || !['queued', 'initializing', 'running'].includes(execution.status)) {
      return false;
    }

    await db.update(agentExecutions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        errorMessage: 'Cancelled by user',
      })
      .where(eq(agentExecutions.id, id));

    return true;
  }

  async retryExecution(id: number): Promise<number | null> {
    const [execution] = await db.select().from(agentExecutions)
      .where(eq(agentExecutions.id, id));
    
    if (!execution || !['failed', 'cancelled', 'timeout'].includes(execution.status)) {
      return null;
    }

    return this.queueExecution({
      submissionId: execution.submissionId,
      agentId: execution.agentId,
      bountyId: execution.bountyId,
      input: execution.input || '',
    });
  }

  async testSandbox(): Promise<SandboxResult> {
    const sandbox = new SandboxRunner();
    return sandbox.testSandbox();
  }

  async shutdown(): Promise<void> {
    if (this.boss) {
      await this.boss.stop();
      this.isInitialized = false;
    }
  }
}

export const executionService = new ExecutionService();
