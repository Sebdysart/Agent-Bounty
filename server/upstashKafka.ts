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

export interface KafkaMessage<T = unknown> {
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

// Retry configuration: exponential backoff (1s, 2s, 4s, 8s, max 5 retries)
const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff: 1s, 2s, 4s, 8s (cap at 8s)
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

// ============================================================================
// KafkaConsumer Class with Batch Processing
// ============================================================================

export interface KafkaConsumerConfig {
  url?: string;
  username?: string;
  password?: string;
  groupId?: string;
  instanceId?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelays?: number[];
}

export interface ConsumeOptions {
  maxMessages?: number;
  autoCommit?: boolean;
}

export interface BatchProcessResult {
  processed: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
  dlqSent: number;
}

/**
 * Dedicated KafkaConsumer class with batch processing and configurable retry logic.
 * Supports message batching, automatic DLQ handling, and exponential backoff.
 */
export class KafkaConsumer {
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private isConfigured = false;
  private groupId: string;
  private instanceId: string;
  private batchSize: number;
  private maxRetries: number;
  private retryDelays: number[];

  constructor(config?: KafkaConsumerConfig) {
    const url = config?.url || process.env.UPSTASH_KAFKA_REST_URL;
    const username = config?.username || process.env.UPSTASH_KAFKA_REST_USERNAME;
    const password = config?.password || process.env.UPSTASH_KAFKA_REST_PASSWORD;

    this.groupId = config?.groupId || "default-group";
    this.instanceId = config?.instanceId || `instance-${Date.now()}`;
    this.batchSize = config?.batchSize ?? 10;
    this.maxRetries = config?.maxRetries ?? MAX_RETRIES;
    this.retryDelays = config?.retryDelays ?? RETRY_DELAYS;

    if (url && username && password) {
      this.kafka = new Kafka({ url, username, password });
      this.consumer = this.kafka.consumer();
      this.producer = this.kafka.producer(); // For DLQ and retries
      this.isConfigured = true;
    }
  }

  /**
   * Check if the consumer is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.consumer !== null;
  }

  /**
   * Get the current consumer configuration
   */
  getConfig(): { groupId: string; instanceId: string; batchSize: number; maxRetries: number; retryDelays: number[] } {
    return {
      groupId: this.groupId,
      instanceId: this.instanceId,
      batchSize: this.batchSize,
      maxRetries: this.maxRetries,
      retryDelays: [...this.retryDelays],
    };
  }

  /**
   * Consume messages from a topic
   */
  async consume<T>(
    topic: KafkaTopic,
    options?: ConsumeOptions
  ): Promise<ConsumeResult<T>> {
    if (!this.consumer) {
      return {
        messages: [],
        error: "Kafka consumer not configured",
      };
    }

    try {
      const result = await this.consumer.consume({
        consumerGroupId: this.groupId,
        instanceId: this.instanceId,
        topics: [topic],
        autoOffsetReset: "earliest",
      });

      const messages: KafkaMessage<T>[] = [];
      const maxMessages = options?.maxMessages ?? this.batchSize;

      for (const msg of result) {
        try {
          const parsed = JSON.parse(msg.value) as KafkaMessage<T>;
          messages.push(parsed);

          if (messages.length >= maxMessages) {
            break;
          }
        } catch (parseError) {
          console.error("KafkaConsumer: Failed to parse message:", parseError);
        }
      }

      return { messages };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("KafkaConsumer: consume error:", errorMessage);
      return {
        messages: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Consume a batch of messages from a topic
   */
  async consumeBatch<T>(
    topic: KafkaTopic,
    batchSize?: number
  ): Promise<ConsumeResult<T>> {
    return this.consume<T>(topic, { maxMessages: batchSize ?? this.batchSize });
  }

  /**
   * Process messages in batch with a handler function.
   * Handles retries with exponential backoff and automatic DLQ for exhausted retries.
   */
  async processBatch<T>(
    topic: KafkaTopic,
    handler: (message: KafkaMessage<T>) => Promise<void>,
    options?: { batchSize?: number }
  ): Promise<BatchProcessResult> {
    const result = await this.consumeBatch<T>(topic, options?.batchSize);

    let processed = 0;
    let failed = 0;
    let dlqSent = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    for (const message of result.messages) {
      try {
        await handler(message);
        processed++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({ messageId: message.id, error: errorMessage });

        // Check if max retries exceeded
        const retryCount = (message.retryCount ?? 0) + 1;
        if (retryCount >= this.maxRetries) {
          // Send to DLQ
          await this.sendToDLQ(message, errorMessage);
          dlqSent++;
        } else {
          // Retry with incremented count
          await this.retryMessage(topic, message, retryCount);
        }
      }
    }

    return { processed, failed, errors, dlqSent };
  }

  /**
   * Process messages in parallel batches for higher throughput.
   * Uses Promise.allSettled to handle partial failures gracefully.
   */
  async processParallelBatch<T>(
    topic: KafkaTopic,
    handler: (message: KafkaMessage<T>) => Promise<void>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<BatchProcessResult> {
    const result = await this.consumeBatch<T>(topic, options?.batchSize);
    const concurrency = options?.concurrency ?? 5;

    let processed = 0;
    let failed = 0;
    let dlqSent = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    // Process in chunks based on concurrency
    for (let i = 0; i < result.messages.length; i += concurrency) {
      const chunk = result.messages.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        chunk.map(async (message) => {
          await handler(message);
          return message;
        })
      );

      for (let j = 0; j < results.length; j++) {
        const settledResult = results[j];
        const message = chunk[j];

        if (settledResult.status === "fulfilled") {
          processed++;
        } else {
          failed++;
          const errorMessage = settledResult.reason instanceof Error
            ? settledResult.reason.message
            : "Unknown error";
          errors.push({ messageId: message.id, error: errorMessage });

          const retryCount = (message.retryCount ?? 0) + 1;
          if (retryCount >= this.maxRetries) {
            await this.sendToDLQ(message, errorMessage);
            dlqSent++;
          } else {
            await this.retryMessage(topic, message, retryCount);
          }
        }
      }
    }

    return { processed, failed, errors, dlqSent };
  }

  /**
   * Retry a failed message with incremented retry count
   */
  private async retryMessage<T>(
    topic: KafkaTopic,
    message: KafkaMessage<T>,
    retryCount: number
  ): Promise<void> {
    if (!this.producer) {
      console.error("KafkaConsumer: Cannot retry - producer not configured");
      return;
    }

    const retryMessage: KafkaMessage<T> = {
      ...message,
      retryCount,
    };

    try {
      await this.producer.produce(topic, JSON.stringify(retryMessage));
    } catch (error) {
      console.error("KafkaConsumer: Failed to retry message:", error);
    }
  }

  /**
   * Send a failed message to the dead-letter queue
   */
  private async sendToDLQ<T>(
    originalMessage: KafkaMessage<T>,
    errorReason: string
  ): Promise<void> {
    if (!this.producer) {
      console.error("KafkaConsumer: Cannot send to DLQ - producer not configured");
      return;
    }

    const dlqMessage: DeadLetterMessage<T> = {
      originalMessage,
      errorReason,
      failedAt: Date.now(),
      originalTopic: originalMessage.topic,
    };

    const wrappedMessage: KafkaMessage<DeadLetterMessage<T>> = {
      id: `dlq-${originalMessage.id}`,
      topic: KAFKA_TOPICS.AGENT_EXECUTION_DLQ,
      data: dlqMessage,
      timestamp: Date.now(),
    };

    try {
      await this.producer.produce(KAFKA_TOPICS.AGENT_EXECUTION_DLQ, JSON.stringify(wrappedMessage));
    } catch (error) {
      console.error("KafkaConsumer: Failed to send to DLQ:", error);
    }
  }

  /**
   * Create a polling consumer that continuously processes messages
   */
  async startPolling<T>(
    topic: KafkaTopic,
    handler: (message: KafkaMessage<T>) => Promise<void>,
    options?: {
      batchSize?: number;
      pollIntervalMs?: number;
      onBatchComplete?: (result: BatchProcessResult) => void;
    }
  ): Promise<{ stop: () => void }> {
    let running = true;
    const pollInterval = options?.pollIntervalMs ?? 1000;

    const poll = async () => {
      while (running) {
        try {
          const result = await this.processBatch<T>(topic, handler, {
            batchSize: options?.batchSize,
          });

          if (options?.onBatchComplete) {
            options.onBatchComplete(result);
          }

          // Only wait if we didn't process any messages (avoid tight loops on empty queues)
          if (result.processed === 0 && result.failed === 0) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }
        } catch (error) {
          console.error("KafkaConsumer: Polling error:", error);
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }
    };

    // Start polling in the background
    poll();

    return {
      stop: () => {
        running = false;
      },
    };
  }
}

// ============================================================================
// DeadLetterQueueHandler Class
// ============================================================================

export interface DLQHandlerConfig {
  url?: string;
  username?: string;
  password?: string;
  groupId?: string;
  instanceId?: string;
}

export interface DLQMessage<T = unknown> {
  id: string;
  originalMessage: KafkaMessage<T>;
  errorReason: string;
  failedAt: number;
  originalTopic: KafkaTopic;
}

export interface DLQProcessResult {
  replayed: number;
  deleted: number;
  errors: Array<{ messageId: string; error: string }>;
}

export interface DLQStats {
  totalMessages: number;
  oldestMessageAge?: number;
  newestMessageAge?: number;
  byTopic: Record<string, number>;
  byErrorReason: Record<string, number>;
}

/**
 * Dedicated Dead-Letter Queue Handler for processing failed messages.
 * Provides functionality to inspect, replay, and delete DLQ messages.
 */
export class DeadLetterQueueHandler {
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private isConfigured = false;
  private groupId: string;
  private instanceId: string;

  constructor(config?: DLQHandlerConfig) {
    const url = config?.url || process.env.UPSTASH_KAFKA_REST_URL;
    const username = config?.username || process.env.UPSTASH_KAFKA_REST_USERNAME;
    const password = config?.password || process.env.UPSTASH_KAFKA_REST_PASSWORD;

    this.groupId = config?.groupId || "dlq-handler-group";
    this.instanceId = config?.instanceId || `dlq-handler-${Date.now()}`;

    if (url && username && password) {
      this.kafka = new Kafka({ url, username, password });
      this.consumer = this.kafka.consumer();
      this.producer = this.kafka.producer();
      this.isConfigured = true;
    }
  }

  /**
   * Check if the handler is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.consumer !== null && this.producer !== null;
  }

  /**
   * Fetch messages from the dead-letter queue
   */
  async fetchMessages<T = unknown>(
    options?: { maxMessages?: number }
  ): Promise<{ messages: DLQMessage<T>[]; error?: string }> {
    if (!this.consumer) {
      return { messages: [], error: "DLQ handler not configured" };
    }

    try {
      const result = await this.consumer.consume({
        consumerGroupId: this.groupId,
        instanceId: this.instanceId,
        topics: [KAFKA_TOPICS.AGENT_EXECUTION_DLQ],
        autoOffsetReset: "earliest",
      });

      const messages: DLQMessage<T>[] = [];
      const maxMessages = options?.maxMessages ?? 100;

      for (const msg of result) {
        try {
          const parsed = JSON.parse(msg.value) as KafkaMessage<DeadLetterMessage<T>>;
          const dlqData = parsed.data;

          messages.push({
            id: parsed.id,
            originalMessage: dlqData.originalMessage,
            errorReason: dlqData.errorReason,
            failedAt: dlqData.failedAt,
            originalTopic: dlqData.originalTopic,
          });

          if (messages.length >= maxMessages) {
            break;
          }
        } catch (parseError) {
          console.error("DeadLetterQueueHandler: Failed to parse message:", parseError);
        }
      }

      return { messages };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("DeadLetterQueueHandler: fetch error:", errorMessage);
      return { messages: [], error: errorMessage };
    }
  }

  /**
   * Replay a single message back to its original topic
   */
  async replayMessage<T = unknown>(message: DLQMessage<T>): Promise<{ success: boolean; error?: string }> {
    if (!this.producer) {
      return { success: false, error: "DLQ handler not configured" };
    }

    try {
      // Reset retry count when replaying
      const replayedMessage: KafkaMessage<T> = {
        ...message.originalMessage,
        retryCount: 0,
        timestamp: Date.now(),
      };

      await this.producer.produce(
        message.originalTopic,
        JSON.stringify(replayedMessage)
      );

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("DeadLetterQueueHandler: replay error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Replay multiple messages back to their original topics
   */
  async replayMessages<T = unknown>(
    messages: DLQMessage<T>[]
  ): Promise<DLQProcessResult> {
    let replayed = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    for (const message of messages) {
      const result = await this.replayMessage(message);
      if (result.success) {
        replayed++;
      } else {
        errors.push({ messageId: message.id, error: result.error || "Unknown error" });
      }
    }

    return { replayed, deleted: 0, errors };
  }

  /**
   * Replay all messages that match a filter criteria
   */
  async replayFiltered<T = unknown>(
    filter: (message: DLQMessage<T>) => boolean,
    options?: { maxMessages?: number }
  ): Promise<DLQProcessResult> {
    const { messages, error } = await this.fetchMessages<T>(options);

    if (error) {
      return { replayed: 0, deleted: 0, errors: [{ messageId: "fetch", error }] };
    }

    const filtered = messages.filter(filter);
    return this.replayMessages(filtered);
  }

  /**
   * Replay messages from a specific original topic
   */
  async replayByTopic<T = unknown>(
    topic: KafkaTopic,
    options?: { maxMessages?: number }
  ): Promise<DLQProcessResult> {
    return this.replayFiltered<T>(
      (msg) => msg.originalTopic === topic,
      options
    );
  }

  /**
   * Replay messages that failed within a specific time window
   */
  async replayByTimeWindow<T = unknown>(
    startTime: number,
    endTime: number,
    options?: { maxMessages?: number }
  ): Promise<DLQProcessResult> {
    return this.replayFiltered<T>(
      (msg) => msg.failedAt >= startTime && msg.failedAt <= endTime,
      options
    );
  }

  /**
   * Get statistics about messages in the DLQ
   */
  async getStats(options?: { maxMessages?: number }): Promise<DLQStats> {
    const { messages } = await this.fetchMessages(options);

    const now = Date.now();
    const byTopic: Record<string, number> = {};
    const byErrorReason: Record<string, number> = {};
    let oldestAge: number | undefined;
    let newestAge: number | undefined;

    for (const msg of messages) {
      // Count by topic
      byTopic[msg.originalTopic] = (byTopic[msg.originalTopic] || 0) + 1;

      // Count by error reason (truncate long errors)
      const reasonKey = msg.errorReason.substring(0, 100);
      byErrorReason[reasonKey] = (byErrorReason[reasonKey] || 0) + 1;

      // Track age
      const age = now - msg.failedAt;
      if (oldestAge === undefined || age > oldestAge) {
        oldestAge = age;
      }
      if (newestAge === undefined || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      totalMessages: messages.length,
      oldestMessageAge: oldestAge,
      newestMessageAge: newestAge,
      byTopic,
      byErrorReason,
    };
  }

  /**
   * Process DLQ messages with a custom handler.
   * Allows inspection and decision-making per message.
   */
  async processMessages<T = unknown>(
    handler: (message: DLQMessage<T>) => Promise<"replay" | "skip" | "delete">,
    options?: { maxMessages?: number }
  ): Promise<DLQProcessResult> {
    const { messages, error } = await this.fetchMessages<T>(options);

    if (error) {
      return { replayed: 0, deleted: 0, errors: [{ messageId: "fetch", error }] };
    }

    let replayed = 0;
    let deleted = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    for (const message of messages) {
      try {
        const action = await handler(message);

        if (action === "replay") {
          const result = await this.replayMessage(message);
          if (result.success) {
            replayed++;
          } else {
            errors.push({ messageId: message.id, error: result.error || "Replay failed" });
          }
        } else if (action === "delete") {
          // In Kafka, messages are not explicitly deleted but consumed.
          // The offset commit handles "deletion" by not reprocessing.
          deleted++;
        }
        // "skip" does nothing
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        errors.push({ messageId: message.id, error: errorMessage });
      }
    }

    return { replayed, deleted, errors };
  }

  /**
   * Create an alert for DLQ messages exceeding thresholds
   */
  async checkAlertThresholds(thresholds: {
    maxMessages?: number;
    maxAgeMs?: number;
  }): Promise<{ alert: boolean; reasons: string[] }> {
    const stats = await this.getStats();
    const reasons: string[] = [];

    if (thresholds.maxMessages && stats.totalMessages > thresholds.maxMessages) {
      reasons.push(`DLQ has ${stats.totalMessages} messages (threshold: ${thresholds.maxMessages})`);
    }

    if (thresholds.maxAgeMs && stats.oldestMessageAge && stats.oldestMessageAge > thresholds.maxAgeMs) {
      const ageHours = Math.round(stats.oldestMessageAge / (1000 * 60 * 60));
      const thresholdHours = Math.round(thresholds.maxAgeMs / (1000 * 60 * 60));
      reasons.push(`Oldest DLQ message is ${ageHours}h old (threshold: ${thresholdHours}h)`);
    }

    return {
      alert: reasons.length > 0,
      reasons,
    };
  }
}

// ============================================================================
// PgBoss-Compatible Adapter
// ============================================================================

/**
 * Job state matching pg-boss states
 */
export type JobState = 'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed';

/**
 * Job interface matching pg-boss Job<T>
 */
export interface Job<T = object> {
  id: string;
  name: string;
  data: T;
  expireInSeconds: number;
}

/**
 * Job with metadata matching pg-boss JobWithMetadata<T>
 */
export interface JobWithMetadata<T = object> extends Job<T> {
  priority: number;
  state: JobState;
  retryLimit: number;
  retryCount: number;
  retryDelay: number;
  retryBackoff: boolean;
  startAfter: Date;
  startedOn: Date;
  singletonKey: string | null;
  createdOn: Date;
  completedOn: Date | null;
  keepUntil: Date;
}

/**
 * Send options matching pg-boss SendOptions
 */
export interface SendOptions {
  id?: string;
  priority?: number;
  startAfter?: number | string | Date;
  singletonKey?: string;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  expireInMinutes?: number;
  expireInHours?: number;
}

/**
 * Work options matching pg-boss WorkOptions
 */
export interface WorkOptions {
  includeMetadata?: boolean;
  priority?: boolean;
  batchSize?: number;
  pollingIntervalSeconds?: number;
}

/**
 * Fetch options matching pg-boss FetchOptions
 */
export interface FetchOptions {
  includeMetadata?: boolean;
  priority?: boolean;
  batchSize?: number;
}

/**
 * Work handler matching pg-boss WorkHandler
 */
export interface WorkHandler<ReqData> {
  (jobs: Job<ReqData>[]): Promise<void>;
}

/**
 * Work handler with metadata matching pg-boss WorkWithMetadataHandler
 */
export interface WorkWithMetadataHandler<ReqData> {
  (jobs: JobWithMetadata<ReqData>[]): Promise<void>;
}

/**
 * Internal job storage for tracking job states
 */
interface InternalJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  state: JobState;
  priority: number;
  retryLimit: number;
  retryCount: number;
  retryDelay: number;
  retryBackoff: boolean;
  expireInSeconds: number;
  startAfter: Date;
  startedOn: Date | null;
  createdOn: Date;
  completedOn: Date | null;
  singletonKey: string | null;
  keepUntil: Date;
}

export interface KafkaJobQueueConfig {
  url?: string;
  username?: string;
  password?: string;
}

/**
 * PgBoss-compatible adapter for Upstash Kafka.
 * Provides a familiar job queue interface backed by Kafka topics.
 *
 * Key differences from pg-boss:
 * - Jobs are stored in Kafka topics instead of PostgreSQL
 * - No built-in scheduling (use external cron for scheduled jobs)
 * - Simpler state management (no database transactions)
 */
export class KafkaJobQueue {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConfigured = false;
  private workers: Map<string, { stop: () => void; id: string }> = new Map();
  private jobStates: Map<string, InternalJob> = new Map();
  private started = false;

  constructor(config?: KafkaJobQueueConfig) {
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
   * Start the job queue (required before sending/working jobs)
   */
  async start(): Promise<this> {
    if (!this.isConfigured) {
      throw new Error("KafkaJobQueue: Not configured - missing Upstash Kafka credentials");
    }
    this.started = true;
    return this;
  }

  /**
   * Stop the job queue and all workers
   */
  async stop(options?: { graceful?: boolean; timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 5000;

    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(async (worker) => {
      worker.stop();
    });

    if (options?.graceful) {
      await Promise.race([
        Promise.all(stopPromises),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]);
    } else {
      this.workers.clear();
    }

    this.started = false;
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Calculate expiration in seconds from options
   */
  private calculateExpiration(options?: SendOptions): number {
    if (options?.expireInSeconds) return options.expireInSeconds;
    if (options?.expireInMinutes) return options.expireInMinutes * 60;
    if (options?.expireInHours) return options.expireInHours * 3600;
    return 3600; // Default 1 hour
  }

  /**
   * Calculate startAfter date from options
   */
  private calculateStartAfter(options?: SendOptions): Date {
    if (!options?.startAfter) return new Date();
    if (options.startAfter instanceof Date) return options.startAfter;
    if (typeof options.startAfter === 'number') {
      return new Date(Date.now() + options.startAfter * 1000);
    }
    return new Date(options.startAfter);
  }

  /**
   * Map queue name to Kafka topic
   */
  private queueToTopic(name: string): KafkaTopic {
    // Map common queue names to our defined topics
    const topicMap: Record<string, KafkaTopic> = {
      'agent-execution': KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
      'agent-results': KAFKA_TOPICS.AGENT_RESULTS_QUEUE,
      'notifications': KAFKA_TOPICS.NOTIFICATIONS_QUEUE,
    };
    return topicMap[name] || KAFKA_TOPICS.AGENT_EXECUTION_QUEUE;
  }

  /**
   * Send a job to a queue (pg-boss compatible)
   */
  async send(name: string, data: object, options?: SendOptions): Promise<string | null> {
    if (!this.producer || !this.started) {
      return null;
    }

    const jobId = options?.id || this.generateJobId();
    const topic = this.queueToTopic(name);
    const expireInSeconds = this.calculateExpiration(options);
    const startAfter = this.calculateStartAfter(options);

    const internalJob: InternalJob = {
      id: jobId,
      name,
      data,
      state: 'created',
      priority: options?.priority ?? 0,
      retryLimit: options?.retryLimit ?? MAX_RETRIES,
      retryCount: 0,
      retryDelay: options?.retryDelay ?? 1000,
      retryBackoff: options?.retryBackoff ?? true,
      expireInSeconds,
      startAfter,
      startedOn: null,
      createdOn: new Date(),
      completedOn: null,
      singletonKey: options?.singletonKey ?? null,
      keepUntil: new Date(Date.now() + expireInSeconds * 1000),
    };

    // Check singleton constraint
    if (options?.singletonKey) {
      const jobs = Array.from(this.jobStates.values());
      for (const job of jobs) {
        if (job.singletonKey === options.singletonKey &&
            job.state !== 'completed' &&
            job.state !== 'failed' &&
            job.state !== 'cancelled') {
          // Singleton job already exists
          return null;
        }
      }
    }

    const kafkaMessage: KafkaMessage<InternalJob> = {
      id: jobId,
      topic,
      data: internalJob,
      timestamp: Date.now(),
      idempotencyKey: `job-${jobId}`,
    };

    try {
      await this.producer.produce(topic, JSON.stringify(kafkaMessage));
      this.jobStates.set(jobId, internalJob);
      return jobId;
    } catch (error) {
      console.error("KafkaJobQueue: send error:", error);
      return null;
    }
  }

  /**
   * Fetch jobs from a queue without processing (pg-boss compatible)
   */
  async fetch<T>(name: string, options?: FetchOptions): Promise<Job<T>[] | JobWithMetadata<T>[]> {
    if (!this.consumer || !this.started) {
      return [];
    }

    const topic = this.queueToTopic(name);
    const batchSize = options?.batchSize ?? 1;

    try {
      const result = await this.consumer.consume({
        consumerGroupId: `fetch-${name}`,
        instanceId: `fetch-${Date.now()}`,
        topics: [topic],
        autoOffsetReset: "earliest",
      });

      const jobs: (Job<T> | JobWithMetadata<T>)[] = [];

      for (const msg of result) {
        if (jobs.length >= batchSize) break;

        try {
          const parsed = JSON.parse(msg.value) as KafkaMessage<InternalJob<T>>;
          const internalJob = parsed.data;

          // Skip jobs that aren't ready yet
          if (internalJob.startAfter && new Date(internalJob.startAfter) > new Date()) {
            continue;
          }

          // Mark as active
          internalJob.state = 'active';
          internalJob.startedOn = new Date();
          this.jobStates.set(internalJob.id, internalJob as InternalJob);

          if (options?.includeMetadata) {
            jobs.push({
              id: internalJob.id,
              name: internalJob.name,
              data: internalJob.data,
              expireInSeconds: internalJob.expireInSeconds,
              priority: internalJob.priority,
              state: internalJob.state,
              retryLimit: internalJob.retryLimit,
              retryCount: internalJob.retryCount,
              retryDelay: internalJob.retryDelay,
              retryBackoff: internalJob.retryBackoff,
              startAfter: new Date(internalJob.startAfter),
              startedOn: new Date(internalJob.startedOn!),
              singletonKey: internalJob.singletonKey,
              createdOn: new Date(internalJob.createdOn),
              completedOn: internalJob.completedOn ? new Date(internalJob.completedOn) : null,
              keepUntil: new Date(internalJob.keepUntil),
            } as JobWithMetadata<T>);
          } else {
            jobs.push({
              id: internalJob.id,
              name: internalJob.name,
              data: internalJob.data,
              expireInSeconds: internalJob.expireInSeconds,
            } as Job<T>);
          }
        } catch (parseError) {
          console.error("KafkaJobQueue: parse error:", parseError);
        }
      }

      // Sort by priority if requested
      if (options?.priority) {
        jobs.sort((a, b) => {
          const priorityA = 'priority' in a ? a.priority : 0;
          const priorityB = 'priority' in b ? b.priority : 0;
          return priorityB - priorityA;
        });
      }

      return jobs;
    } catch (error) {
      console.error("KafkaJobQueue: fetch error:", error);
      return [];
    }
  }

  /**
   * Subscribe to work on jobs from a queue (pg-boss compatible)
   */
  async work<ReqData>(
    name: string,
    optionsOrHandler: WorkOptions | WorkHandler<ReqData>,
    handler?: WorkHandler<ReqData> | WorkWithMetadataHandler<ReqData>
  ): Promise<string> {
    const workerId = `worker-${name}-${Date.now()}`;

    let options: WorkOptions = {};
    let workHandler: WorkHandler<ReqData> | WorkWithMetadataHandler<ReqData>;

    if (typeof optionsOrHandler === 'function') {
      workHandler = optionsOrHandler;
    } else {
      options = optionsOrHandler;
      workHandler = handler!;
    }

    const pollingInterval = (options.pollingIntervalSeconds ?? 2) * 1000;
    const batchSize = options.batchSize ?? 1;
    let running = true;

    const poll = async () => {
      while (running && this.started) {
        try {
          const jobs = await this.fetch<ReqData>(name, {
            includeMetadata: options.includeMetadata,
            priority: options.priority,
            batchSize,
          });

          if (jobs.length > 0) {
            try {
              await (workHandler as WorkHandler<ReqData>)(jobs as Job<ReqData>[]);
              // Auto-complete jobs on successful processing
              for (const job of jobs) {
                await this.complete(name, job.id);
              }
            } catch (error) {
              // Mark jobs as failed on error
              for (const job of jobs) {
                await this.fail(name, job.id, { error: String(error) });
              }
            }
          } else {
            // No jobs, wait before polling again
            await new Promise((resolve) => setTimeout(resolve, pollingInterval));
          }
        } catch (error) {
          console.error(`KafkaJobQueue: worker ${workerId} error:`, error);
          await new Promise((resolve) => setTimeout(resolve, pollingInterval));
        }
      }
    };

    // Start polling in background
    poll();

    this.workers.set(workerId, {
      id: workerId,
      stop: () => { running = false; },
    });

    return workerId;
  }

  /**
   * Stop a specific worker
   */
  async offWork(nameOrOptions: string | { id: string }): Promise<void> {
    if (typeof nameOrOptions === 'string') {
      // Stop all workers for this queue name
      const entries = Array.from(this.workers.entries());
      for (const [id, worker] of entries) {
        if (id.includes(`worker-${nameOrOptions}-`)) {
          worker.stop();
          this.workers.delete(id);
        }
      }
    } else {
      // Stop specific worker by ID
      const worker = this.workers.get(nameOrOptions.id);
      if (worker) {
        worker.stop();
        this.workers.delete(nameOrOptions.id);
      }
    }
  }

  /**
   * Mark a job as completed (pg-boss compatible)
   */
  async complete(name: string, id: string, data?: object): Promise<void> {
    const job = this.jobStates.get(id);
    if (job) {
      job.state = 'completed';
      job.completedOn = new Date();
      this.jobStates.set(id, job);
    }
  }

  /**
   * Mark a job as failed (pg-boss compatible)
   */
  async fail(name: string, id: string, data?: object): Promise<void> {
    const job = this.jobStates.get(id);
    if (job) {
      job.retryCount++;

      if (job.retryCount >= job.retryLimit) {
        job.state = 'failed';
        // Send to DLQ
        if (this.producer) {
          const dlqMessage: DeadLetterMessage = {
            originalMessage: {
              id: job.id,
              topic: this.queueToTopic(job.name),
              data: job.data,
              timestamp: job.createdOn.getTime(),
            },
            errorReason: data && typeof data === 'object' && 'error' in data ? String(data.error) : 'Unknown error',
            failedAt: Date.now(),
            originalTopic: this.queueToTopic(job.name),
          };

          try {
            await this.producer.produce(
              KAFKA_TOPICS.AGENT_EXECUTION_DLQ,
              JSON.stringify(dlqMessage)
            );
          } catch (error) {
            console.error("KafkaJobQueue: DLQ send error:", error);
          }
        }
      } else {
        job.state = 'retry';
        // Re-queue for retry
        if (this.producer) {
          const retryDelay = job.retryBackoff
            ? job.retryDelay * Math.pow(2, job.retryCount - 1)
            : job.retryDelay;

          job.startAfter = new Date(Date.now() + retryDelay);

          const kafkaMessage: KafkaMessage<InternalJob> = {
            id: job.id,
            topic: this.queueToTopic(job.name),
            data: job,
            timestamp: Date.now(),
          };

          try {
            await this.producer.produce(
              this.queueToTopic(job.name),
              JSON.stringify(kafkaMessage)
            );
          } catch (error) {
            console.error("KafkaJobQueue: retry send error:", error);
          }
        }
      }

      this.jobStates.set(id, job);
    }
  }

  /**
   * Cancel a job (pg-boss compatible)
   */
  async cancel(name: string, id: string | string[]): Promise<void> {
    const ids = Array.isArray(id) ? id : [id];
    for (const jobId of ids) {
      const job = this.jobStates.get(jobId);
      if (job) {
        job.state = 'cancelled';
        this.jobStates.set(jobId, job);
      }
    }
  }

  /**
   * Get a job by ID (pg-boss compatible)
   */
  async getJobById<T>(name: string, id: string): Promise<JobWithMetadata<T> | null> {
    const job = this.jobStates.get(id) as InternalJob<T> | undefined;
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      expireInSeconds: job.expireInSeconds,
      priority: job.priority,
      state: job.state,
      retryLimit: job.retryLimit,
      retryCount: job.retryCount,
      retryDelay: job.retryDelay,
      retryBackoff: job.retryBackoff,
      startAfter: new Date(job.startAfter),
      startedOn: job.startedOn ? new Date(job.startedOn) : new Date(),
      singletonKey: job.singletonKey,
      createdOn: new Date(job.createdOn),
      completedOn: job.completedOn ? new Date(job.completedOn) : null,
      keepUntil: new Date(job.keepUntil),
    };
  }

  /**
   * Check if the job queue is available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.started;
  }
}

/**
 * Null implementation of KafkaJobQueue for when feature flag is disabled
 */
export class NullJobQueue {
  async start(): Promise<this> { return this; }
  async stop(): Promise<void> {}
  async send(_name: string, _data: object, _options?: SendOptions): Promise<string | null> { return null; }
  async fetch<T>(_name: string, _options?: FetchOptions): Promise<Job<T>[]> { return []; }
  async work<ReqData>(_name: string, _handler: WorkHandler<ReqData>): Promise<string> { return 'null-worker'; }
  async offWork(_nameOrOptions: string | { id: string }): Promise<void> {}
  async complete(_name: string, _id: string, _data?: object): Promise<void> {}
  async fail(_name: string, _id: string, _data?: object): Promise<void> {}
  async cancel(_name: string, _id: string | string[]): Promise<void> {}
  async getJobById<T>(_name: string, _id: string): Promise<JobWithMetadata<T> | null> { return null; }
  isAvailable(): boolean { return false; }
}

// Singleton instances for feature flag-based switching
const kafkaJobQueueInstance = new KafkaJobQueue();
const nullJobQueueInstance = new NullJobQueue();

/**
 * Get the job queue based on the USE_UPSTASH_KAFKA feature flag.
 * Returns the Kafka-backed queue when enabled, or a null implementation when disabled.
 */
export function getJobQueue(userId?: string): KafkaJobQueue | NullJobQueue {
  if (featureFlags.isEnabled("USE_UPSTASH_KAFKA", userId)) {
    return kafkaJobQueueInstance;
  }
  return nullJobQueueInstance;
}

// Export class for testing/custom instances
export { UpstashKafkaClient, NullKafkaClient };
