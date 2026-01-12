import { db } from './db';
import { agentLlmConfigs, agentUploads } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

type LlmProvider = 'openai' | 'anthropic' | 'groq' | 'custom';

interface LlmConfig {
  provider: LlmProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  endpoint?: string;
  apiKey?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LlmResponse {
  content: string;
  provider: LlmProvider;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  usedFallback: boolean;
}

const DEFAULT_CONFIGS: Record<LlmProvider, Partial<LlmConfig>> = {
  openai: {
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
  },
  anthropic: {
    model: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    temperature: 0.7,
  },
  groq: {
    model: 'llama-3.1-8b-instant',
    maxTokens: 4096,
    temperature: 0.7,
  },
  custom: {
    model: 'custom',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

class MultiLlmService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    }
  }

  async setAgentConfig(agentUploadId: number, config: Partial<{
    primaryProvider: LlmProvider;
    fallbackProvider: LlmProvider | null;
    primaryModel: string;
    fallbackModel: string | null;
    maxTokens: number;
    temperature: number;
    customEndpoint: string | null;
  }>) {
    const existing = await db.select()
      .from(agentLlmConfigs)
      .where(eq(agentLlmConfigs.agentUploadId, agentUploadId));

    if (existing.length > 0) {
      await db.update(agentLlmConfigs)
        .set({
          ...config as any,
          updatedAt: new Date(),
        })
        .where(eq(agentLlmConfigs.agentUploadId, agentUploadId));
    } else {
      await db.insert(agentLlmConfigs).values({
        agentUploadId,
        primaryProvider: config.primaryProvider || 'openai',
        fallbackProvider: config.fallbackProvider,
        primaryModel: config.primaryModel || 'gpt-4o-mini',
        fallbackModel: config.fallbackModel,
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature?.toString() || '0.7',
        customEndpoint: config.customEndpoint,
      });
    }
  }

  async getAgentConfig(agentUploadId: number) {
    const [config] = await db.select()
      .from(agentLlmConfigs)
      .where(eq(agentLlmConfigs.agentUploadId, agentUploadId));

    return config || null;
  }

  async chat(
    agentUploadId: number | null,
    messages: ChatMessage[],
    overrideConfig?: Partial<LlmConfig>
  ): Promise<LlmResponse> {
    let config: LlmConfig;
    
    if (agentUploadId) {
      const dbConfig = await this.getAgentConfig(agentUploadId);
      if (dbConfig) {
        config = {
          provider: dbConfig.primaryProvider as LlmProvider,
          model: dbConfig.primaryModel || 'gpt-4o-mini',
          maxTokens: dbConfig.maxTokens || 4096,
          temperature: parseFloat(dbConfig.temperature || '0.7'),
          endpoint: dbConfig.customEndpoint || undefined,
        };
      } else {
        config = { ...DEFAULT_CONFIGS.openai, provider: 'openai' } as LlmConfig;
      }
    } else {
      config = { ...DEFAULT_CONFIGS.openai, provider: 'openai' } as LlmConfig;
    }

    if (overrideConfig) {
      config = { ...config, ...overrideConfig };
    }

    const startTime = Date.now();
    let usedFallback = false;

    try {
      const result = await this.callProvider(config, messages);
      return {
        ...result,
        usedFallback: false,
        latencyMs: Date.now() - startTime,
      };
    } catch (primaryError) {
      console.error(`Primary provider ${config.provider} failed:`, primaryError);

      if (agentUploadId) {
        const dbConfig = await this.getAgentConfig(agentUploadId);
        if (dbConfig?.fallbackProvider) {
          usedFallback = true;
          const fallbackConfig: LlmConfig = {
            provider: dbConfig.fallbackProvider as LlmProvider,
            model: dbConfig.fallbackModel || DEFAULT_CONFIGS[dbConfig.fallbackProvider as LlmProvider].model || '',
            maxTokens: dbConfig.maxTokens || 4096,
            temperature: parseFloat(dbConfig.temperature || '0.7'),
          };

          try {
            const result = await this.callProvider(fallbackConfig, messages);
            return {
              ...result,
              usedFallback: true,
              latencyMs: Date.now() - startTime,
            };
          } catch (fallbackError) {
            console.error(`Fallback provider ${fallbackConfig.provider} also failed:`, fallbackError);
          }
        }
      }

      throw primaryError;
    }
  }

  private async callProvider(
    config: LlmConfig,
    messages: ChatMessage[]
  ): Promise<Omit<LlmResponse, 'latencyMs' | 'usedFallback'>> {
    switch (config.provider) {
      case 'openai':
        return this.callOpenAI(config, messages);
      case 'anthropic':
        return this.callAnthropic(config, messages);
      case 'groq':
        return this.callGroq(config, messages);
      case 'custom':
        return this.callCustom(config, messages);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private async callOpenAI(config: LlmConfig, messages: ChatMessage[]): Promise<Omit<LlmResponse, 'latencyMs' | 'usedFallback'>> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const response = await this.openaiClient.chat.completions.create({
      model: config.model,
      messages: messages as any,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      provider: 'openai',
      model: config.model,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  private async callAnthropic(config: LlmConfig, messages: ChatMessage[]): Promise<Omit<LlmResponse, 'latencyMs' | 'usedFallback'>> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemMessage,
        messages: nonSystemMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || '',
      provider: 'anthropic',
      model: config.model,
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  private async callGroq(config: LlmConfig, messages: ChatMessage[]): Promise<Omit<LlmResponse, 'latencyMs' | 'usedFallback'>> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: 'groq',
      model: config.model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  private async callCustom(config: LlmConfig, messages: ChatMessage[]): Promise<Omit<LlmResponse, 'latencyMs' | 'usedFallback'>> {
    if (!config.endpoint) {
      throw new Error('Custom endpoint not configured');
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || data.content || '',
      provider: 'custom',
      model: config.model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  getAvailableProviders(): LlmProvider[] {
    const providers: LlmProvider[] = [];
    
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) providers.push('openai');
    if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
    if (process.env.GROQ_API_KEY) providers.push('groq');
    providers.push('custom');
    
    return providers;
  }

  getAvailableModels(provider: LlmProvider): string[] {
    switch (provider) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      case 'anthropic':
        return ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'];
      case 'groq':
        return ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      case 'custom':
        return ['custom'];
      default:
        return [];
    }
  }
}

export const multiLlmService = new MultiLlmService();
