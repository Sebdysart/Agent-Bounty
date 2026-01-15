import { Kafka, Producer, Consumer } from "@upstash/kafka";
import { featureFlags } from "./featureFlags";

// Topic definitions for the queue system
export const KAFKA_TOPICS = {
  AGENT_EXECUTION_QUEUE: "agent-execution-queue",
  AGENT_RESULTS_QUEUE: "agent-results-queue",
  NOTIFICATIONS_QUEUE: "notifications-queue",
  AGENT_EXECUTION_DLQ: "agent-execution-dlq",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// ============================================================================
// Message Types for Topics
// ============================================================================

/**
 * Message type for the agent-execution-queue topic.
 * Contains all information needed to execute an agent against a bounty.
 */
export interface AgentExecutionMessage {
  agentId: string;
  bountyId: string;
  code: string;
  testCases?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Message type for the agent-results-queue topic.
 * Contains the result of an agent execution.
 */
export interface AgentResultMessage {
  executionId: string;
  agentId: string;
  bountyId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}

/**
 * Notification types supported by the system.
 */
export type NotificationType = "email" | "webhook" | "alert";

/**
 * Message type for the notifications-queue topic.
 * Contains notification details for various delivery channels.
 */
export interface NotificationMessage {
  type: NotificationType;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * Message type for the dead-letter queue.
 * Wraps failed messages with error context.
 */
export interface DeadLetterMessage<T = unknown> {
  originalMessage: KafkaMessage<T>;
  errorReason: string;
  failedAt: number;
  originalTopic: KafkaTopic;
}

// ============================================================================
// Internal Types
// ============================================================================

interface UpstashKafkaConfig {
  url?: string;
  username?: string;
  password?: string;
}

interface KafkaMessage<T = unknown> {
  id: string;
  topic: KafkaTopic;
  data: T;
  timestamp: number;
  retryCount?: number;
  idempotencyKey?: string;
}

interface ProduceResult {
  success: boolean;
  topic: string;
  partition?: number;
  offset?: string;
  error?: string;
}

interface ConsumeResult<T = unknown> {
  messages: KafkaMessage<T>[];
  error?: string;
}

interface KafkaHealthStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

// Retry configuration
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
const MAX_RETRIES = 5;

// ============================================================================
// KafkaProducer Class with Retry Logic
// ============================================================================

export interface KafkaProducerConfig {
  url?: string;
  username?: string;
  password?: string;
  maxRetries?: number;
  retryDelays?: number[];
}

export interface ProduceOptions {
  idempotencyKey?: string;
  key?: string;
  partition?: number;
  headers?: Record<string, string>;
}

/**
 * Dedicated KafkaProducer class with configurable retry logic.
 * Provides exponential backoff (1s, 2s, 4s, 8s, max 5 retries by default).
 */
export class KafkaProducer {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConfigured = false;
  private maxRetries: number;
  private retryDelays: number[];

  constructor(config?: KafkaProducerConfig) {
    const url = config?.url || process.env.UPSTASH_KAFKA_REST_URL;
    const username = config?.username || process.env.UPSTASH_KAFKA_REST_USERNAME;
    const password = config?.password || process.env.UPSTASH_KAFKA_REST_PASSWORD;

    this.maxRetries = config?.maxRetries ?? MAX_RETRIES;
    this.retryDelays = config?.retryDelays ?? RETRY_DELAYS;

    if (url && username && password) {
      this.kafka = new Kafka({ url, username, password });
      this.producer = this.kafka.producer();
      this.isConfigured = true;
    }
  }

  /**
   * Check if the producer is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.producer !== null;
  }

  /**
   * Sleep for a specified duration (for retry backoff)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the delay for a given retry attempt using exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    return this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Produce a message to a topic with retry logic.
   * Uses exponential backoff: 1s, 2s, 4s, 8s (max 5 retries by default).
   */
  async produce<T>(
    topic: KafkaTopic,
    data: T,
    options?: ProduceOptions
  ): Promise<ProduceResult> {
    if (!this.producer) {
      return {
        success: false,
        topic,
        error: "Kafka producer not configured",
      };
    }

    const message: KafkaMessage<T> = {
      id: this.generateMessageId(),
      topic,
      data,
      timestamp: Date.now(),
      idempotencyKey: options?.idempotencyKey,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.producer.produce(topic, JSON.stringify(message), {
          key: options?.key,
          partition: options?.partition,
          headers: options?.headers ? Object.entries(options.headers).map(([k, v]) => ({ key: k, value: v })) : undefined,
        });
        return {
          success: true,
          topic,
          partition: result.partition,
          offset: result.offset?.toString(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `KafkaProducer: produce error (attempt ${attempt + 1}/${this.maxRetries}):`,
          lastError.message
        );

        if (attempt < this.maxRetries - 1) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      topic,
      error: lastError?.message || "Unknown error after max retries",
    };
  }

  /**
   * Produce multiple messages in batch with retry logic per message
   */
  async produceBatch<T>(
    messages: Array<{ topic: KafkaTopic; data: T; options?: ProduceOptions }>
  ): Promise<ProduceResult[]> {
    return Promise.all(
      messages.map((msg) => this.produce(msg.topic, msg.data, msg.options))
    );
  }

  /**
   * Produce with a single retry attempt (no retries).
   * Useful when caller wants to handle retry logic externally.
   */
  async produceOnce<T>(
    topic: KafkaTopic,
    data: T,
    options?: ProduceOptions
  ): Promise<ProduceResult> {
    if (!this.producer) {
      return {
        success: false,
        topic,
        error: "Kafka producer not configured",
      };
    }

    const message: KafkaMessage<T> = {
      id: this.generateMessageId(),
      topic,
      data,
      timestamp: Date.now(),
      idempotencyKey: options?.idempotencyKey,
    };

    try {
      const result = await this.producer.produce(topic, JSON.stringify(message), {
        key: options?.key,
        partition: options?.partition,
        headers: options?.headers ? Object.entries(options.headers).map(([k, v]) => ({ key: k, value: v })) : undefined,
      });
      return {
        success: true,
        topic,
        partition: result.partition,
        offset: result.offset?.toString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        topic,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current retry configuration
   */
  getRetryConfig(): { maxRetries: number; retryDelays: number[] } {
    return {
      maxRetries: this.maxRetries,
      retryDelays: [...this.retryDelays],
    };
  }
}

/**
 * Upstash Kafka client wrapper for serverless-friendly message queuing.
 * Implements producer/consumer with retry logic and dead-letter queue handling.
 */
class UpstashKafkaClient {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConfigured = false;

  constructor(config?: UpstashKafkaConfig) {
    const url = config?.url || process.env.UPSTASH_KAFKA_REST_URL;
    const username = config?.username || process.env.UPSTASH_KAFKA_REST_USERNAME;
    const password = config?.password || process.env.UPSTASH_KAFKA_REST_PASSWORD;

    if (url && username && password) {
      this.kafka = new Kafka({ url, username, password });
      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer();
      this.isConfigured = true;
    }
  }

  /**
   * Check if Upstash Kafka is configured and available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.kafka !== null;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Sleep for a specified duration (for retry backoff)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Produce a message to a topic with retry logic
   */
  async produce<T>(
    topic: KafkaTopic,
    data: T,
    options?: { idempotencyKey?: string; retryCount?: number }
  ): Promise<ProduceResult> {
    if (!this.producer) {
      return {
        success: false,
        topic,
        error: "Kafka producer not configured",
      };
    }

    const message: KafkaMessage<T> = {
      id: this.generateMessageId(),
      topic,
      data,
      timestamp: Date.now(),
      retryCount: options?.retryCount ?? 0,
      idempotencyKey: options?.idempotencyKey,
    };

    let lastError: Error | null = null;
    const maxAttempts = options?.retryCount !== undefined ? 1 : MAX_RETRIES;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.producer.produce(topic, JSON.stringify(message));
        return {
          success: true,
          topic,
          partition: result.partition,
          offset: result.offset?.toString(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Upstash Kafka produce error (attempt ${attempt + 1}/${maxAttempts}):`,
          lastError.message
        );

        if (attempt < maxAttempts - 1) {
          const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      topic,
      error: lastError?.message || "Unknown error",
    };
  }

  /**
   * Produce multiple messages in batch
   */
  async produceBatch<T>(
    messages: Array<{ topic: KafkaTopic; data: T; idempotencyKey?: string }>
  ): Promise<ProduceResult[]> {
    return Promise.all(
      messages.map((msg) =>
        this.produce(msg.topic, msg.data, { idempotencyKey: msg.idempotencyKey })
      )
    );
  }

  /**
   * Consume messages from a topic
   */
  async consume<T>(
    topic: KafkaTopic,
    options?: { groupId?: string; instanceId?: string; maxMessages?: number }
  ): Promise<ConsumeResult<T>> {
    if (!this.consumer) {
      return {
        messages: [],
        error: "Kafka consumer not configured",
      };
    }

    try {
      const result = await this.consumer.consume({
        consumerGroupId: options?.groupId || "default-group",
        instanceId: options?.instanceId || "default-instance",
        topics: [topic],
        autoOffsetReset: "earliest",
      });

      const messages: KafkaMessage<T>[] = [];

      for (const msg of result) {
        try {
          const parsed = JSON.parse(msg.value) as KafkaMessage<T>;
          messages.push(parsed);

          if (options?.maxMessages && messages.length >= options.maxMessages) {
            break;
          }
        } catch (parseError) {
          console.error("Failed to parse Kafka message:", parseError);
        }
      }

      return { messages };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Upstash Kafka consume error:", errorMessage);
      return {
        messages: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Process messages with a handler function and automatic DLQ handling
   */
  async processMessages<T>(
    topic: KafkaTopic,
    handler: (message: KafkaMessage<T>) => Promise<void>,
    options?: { groupId?: string; instanceId?: string; maxMessages?: number }
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    const result = await this.consume<T>(topic, options);
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const message of result.messages) {
      try {
        await handler(message);
        processed++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Message ${message.id}: ${errorMessage}`);

        // Send to DLQ if max retries exceeded
        const retryCount = (message.retryCount ?? 0) + 1;
        if (retryCount >= MAX_RETRIES) {
          await this.sendToDLQ(message, errorMessage);
        } else {
          // Retry with incremented count
          await this.produce(topic, message.data, {
            idempotencyKey: message.idempotencyKey,
            retryCount,
          });
        }
      }
    }

    return { processed, failed, errors };
  }

  /**
   * Send a failed message to the dead-letter queue
   */
  async sendToDLQ<T>(
    originalMessage: KafkaMessage<T>,
    errorReason: string
  ): Promise<ProduceResult> {
    const dlqMessage = {
      originalMessage,
      errorReason,
      failedAt: Date.now(),
      originalTopic: originalMessage.topic,
    };

    return this.produce(KAFKA_TOPICS.AGENT_EXECUTION_DLQ, dlqMessage);
  }

  /**
   * Queue an agent execution job
   */
  async queueAgentExecution(jobData: AgentExecutionMessage): Promise<ProduceResult> {
    const idempotencyKey = `exec-${jobData.agentId}-${jobData.bountyId}-${Date.now()}`;
    return this.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, jobData, {
      idempotencyKey,
    });
  }

  /**
   * Queue an agent execution result
   */
  async queueAgentResult(resultData: AgentResultMessage): Promise<ProduceResult> {
    const idempotencyKey = `result-${resultData.executionId}`;
    return this.produce(KAFKA_TOPICS.AGENT_RESULTS_QUEUE, resultData, {
      idempotencyKey,
    });
  }

  /**
   * Queue a notification
   */
  async queueNotification(notification: NotificationMessage): Promise<ProduceResult> {
    const idempotencyKey = `notif-${notification.type}-${notification.recipient}-${Date.now()}`;
    return this.produce(KAFKA_TOPICS.NOTIFICATIONS_QUEUE, notification, {
      idempotencyKey,
    });
  }

  /**
   * Health check - verify Kafka connectivity
   */
  async healthCheck(): Promise<KafkaHealthStatus> {
    if (!this.producer) {
      return {
        connected: false,
        latencyMs: 0,
        error: "Kafka client not configured",
      };
    }

    const start = Date.now();
    try {
      // Attempt a lightweight produce to verify connectivity
      // Using a dedicated health check topic pattern
      await this.producer.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        JSON.stringify({ type: "health-check", timestamp: Date.now() }),
        { key: "health-check" }
      );
      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get consumer lag for monitoring (placeholder - Upstash REST doesn't expose lag directly)
   */
  async getConsumerLag(_topic: KafkaTopic, _groupId: string): Promise<number | null> {
    // Note: Upstash Kafka REST API doesn't directly expose consumer lag
    // This would require tracking offsets manually or using Upstash console
    return null;
  }
}

/**
 * Interface for Kafka operations.
 * Allows for feature flag-based switching between real and null implementations.
 */
export interface IKafkaClient {
  isAvailable(): boolean;
  produce<T>(topic: KafkaTopic, data: T, options?: { idempotencyKey?: string; retryCount?: number }): Promise<ProduceResult>;
  produceBatch<T>(messages: Array<{ topic: KafkaTopic; data: T; idempotencyKey?: string }>): Promise<ProduceResult[]>;
  consume<T>(topic: KafkaTopic, options?: { groupId?: string; instanceId?: string; maxMessages?: number }): Promise<ConsumeResult<T>>;
  processMessages<T>(topic: KafkaTopic, handler: (message: KafkaMessage<T>) => Promise<void>, options?: { groupId?: string; instanceId?: string; maxMessages?: number }): Promise<{ processed: number; failed: number; errors: string[] }>;
  sendToDLQ<T>(originalMessage: KafkaMessage<T>, errorReason: string): Promise<ProduceResult>;
  queueAgentExecution(jobData: AgentExecutionMessage): Promise<ProduceResult>;
  queueAgentResult(resultData: AgentResultMessage): Promise<ProduceResult>;
  queueNotification(notification: NotificationMessage): Promise<ProduceResult>;
  healthCheck(): Promise<KafkaHealthStatus>;
  getConsumerLag(topic: KafkaTopic, groupId: string): Promise<number | null>;
}

/**
 * Null implementation of IKafkaClient that returns safe defaults.
 * Used when USE_UPSTASH_KAFKA feature flag is disabled.
 */
class NullKafkaClient implements IKafkaClient {
  isAvailable(): boolean { return false; }

  async produce<T>(_topic: KafkaTopic, _data: T, _options?: { idempotencyKey?: string; retryCount?: number }): Promise<ProduceResult> {
    return { success: false, topic: _topic, error: "Kafka client not enabled (USE_UPSTASH_KAFKA flag is disabled)" };
  }

  async produceBatch<T>(_messages: Array<{ topic: KafkaTopic; data: T; idempotencyKey?: string }>): Promise<ProduceResult[]> {
    return _messages.map(m => ({ success: false, topic: m.topic, error: "Kafka client not enabled" }));
  }

  async consume<T>(_topic: KafkaTopic, _options?: { groupId?: string; instanceId?: string; maxMessages?: number }): Promise<ConsumeResult<T>> {
    return { messages: [], error: "Kafka client not enabled" };
  }

  async processMessages<T>(_topic: KafkaTopic, _handler: (message: KafkaMessage<T>) => Promise<void>, _options?: { groupId?: string; instanceId?: string; maxMessages?: number }): Promise<{ processed: number; failed: number; errors: string[] }> {
    return { processed: 0, failed: 0, errors: [] };
  }

  async sendToDLQ<T>(_originalMessage: KafkaMessage<T>, _errorReason: string): Promise<ProduceResult> {
    return { success: false, topic: KAFKA_TOPICS.AGENT_EXECUTION_DLQ, error: "Kafka client not enabled" };
  }

  async queueAgentExecution(_jobData: AgentExecutionMessage): Promise<ProduceResult> {
    return { success: false, topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, error: "Kafka client not enabled" };
  }

  async queueAgentResult(_resultData: AgentResultMessage): Promise<ProduceResult> {
    return { success: false, topic: KAFKA_TOPICS.AGENT_RESULTS_QUEUE, error: "Kafka client not enabled" };
  }

  async queueNotification(_notification: NotificationMessage): Promise<ProduceResult> {
    return { success: false, topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE, error: "Kafka client not enabled" };
  }

  async healthCheck(): Promise<KafkaHealthStatus> {
    return { connected: false, latencyMs: 0, error: "USE_UPSTASH_KAFKA feature flag is disabled" };
  }

  async getConsumerLag(_topic: KafkaTopic, _groupId: string): Promise<number | null> {
    return null;
  }
}

// Internal singleton instances
const upstashKafkaInstance = new UpstashKafkaClient();
const nullKafkaInstance = new NullKafkaClient();

/**
 * Get the Kafka client based on the USE_UPSTASH_KAFKA feature flag.
 * Returns the real Upstash client when enabled, or a null implementation when disabled.
 */
export function getKafkaClient(userId?: string): IKafkaClient {
  if (featureFlags.isEnabled("USE_UPSTASH_KAFKA", userId)) {
    return upstashKafkaInstance;
  }
  return nullKafkaInstance;
}

// Singleton instance for the application (checks feature flag on each operation)
export const upstashKafka: IKafkaClient = new Proxy({} as IKafkaClient, {
  get(_target, prop: keyof IKafkaClient) {
    const client = getKafkaClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Export class for testing/custom instances
export { UpstashKafkaClient, NullKafkaClient, KafkaProducer };
export type {
  UpstashKafkaConfig,
  KafkaMessage,
  ProduceResult,
  ConsumeResult,
  KafkaHealthStatus,
  IKafkaClient,
  KafkaProducerConfig,
  ProduceOptions,
  // Message types for topics
  AgentExecutionMessage,
  AgentResultMessage,
  NotificationMessage,
  NotificationType,
  DeadLetterMessage,
};
