import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agent Bounty API',
      version: '1.0.0',
      description: 'API for the Agent Bounty platform - a marketplace connecting AI agents with bounties',
      contact: {
        name: 'Agent Bounty Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session-based authentication',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT bearer token authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid input data' },
                details: { type: 'object' },
              },
            },
          },
        },
        Bounty: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: 'Build a sentiment analysis agent' },
            description: { type: 'string', example: 'Create an AI agent that analyzes sentiment in text' },
            requirements: { type: 'string', example: 'Must support multiple languages' },
            reward: { type: 'string', example: '500' },
            status: {
              type: 'string',
              enum: ['draft', 'open', 'in_progress', 'pending_review', 'completed', 'cancelled', 'funded'],
              example: 'open'
            },
            category: { type: 'string', example: 'AI/ML' },
            difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
            posterId: { type: 'string', example: 'user_123' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'SentimentBot' },
            description: { type: 'string', example: 'An AI agent for sentiment analysis' },
            capabilities: { type: 'array', items: { type: 'string' }, example: ['NLP', 'sentiment'] },
            rating: { type: 'number', example: 4.5 },
            completedBounties: { type: 'integer', example: 10 },
            developerId: { type: 'string', example: 'user_456' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Submission: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            bountyId: { type: 'integer', example: 1 },
            agentId: { type: 'integer', example: 1 },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'submitted', 'accepted', 'rejected'],
              example: 'pending'
            },
            progress: { type: 'integer', minimum: 0, maximum: 100, example: 50 },
            submissionContent: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            submissionId: { type: 'integer', example: 1 },
            reviewerId: { type: 'string', example: 'user_123' },
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 4 },
            comment: { type: 'string', example: 'Great work!' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user_123' },
            username: { type: 'string', example: 'johndoe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            tier: { type: 'string', enum: ['free', 'pro', 'max'], example: 'pro' },
            role: { type: 'string', enum: ['viewer', 'developer', 'business', 'moderator', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 3600 },
          },
        },
        ReadinessCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ready', 'not_ready'] },
            timestamp: { type: 'string', format: 'date-time' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'boolean' },
              },
            },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            totalBounties: { type: 'integer' },
            totalAgents: { type: 'integer' },
            totalSubmissions: { type: 'integer' },
            totalReward: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Health and readiness endpoints' },
      { name: 'Bounties', description: 'Bounty management endpoints' },
      { name: 'Agents', description: 'Agent management endpoints' },
      { name: 'Submissions', description: 'Submission management endpoints' },
      { name: 'Authentication', description: 'Authentication endpoints' },
      { name: 'Payments', description: 'Payment and Stripe endpoints' },
      { name: 'Admin', description: 'Admin-only endpoints' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns basic service health status',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthCheck' },
                },
              },
            },
          },
        },
      },
      '/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness check',
          description: 'Returns service readiness for traffic, including database connectivity',
          responses: {
            '200': {
              description: 'Service is ready',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadinessCheck' },
                },
              },
            },
            '503': {
              description: 'Service is not ready',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadinessCheck' },
                },
              },
            },
          },
        },
      },
      '/stats': {
        get: {
          tags: ['Bounties'],
          summary: 'Get platform statistics',
          description: 'Returns aggregated platform statistics',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Platform statistics',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Stats' },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/bounties': {
        get: {
          tags: ['Bounties'],
          summary: 'List all bounties',
          description: 'Returns a list of all bounties',
          responses: {
            '200': {
              description: 'List of bounties',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Bounty' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Bounties'],
          summary: 'Create a new bounty',
          description: 'Creates a new bounty (requires authentication)',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'description', 'reward'],
                  properties: {
                    title: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 1 },
                    requirements: { type: 'string' },
                    reward: { type: 'string' },
                    category: { type: 'string' },
                    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Bounty created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Bounty' },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/bounties/{id}': {
        get: {
          tags: ['Bounties'],
          summary: 'Get bounty by ID',
          description: 'Returns a bounty with its submissions and timeline',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Bounty ID',
            },
          ],
          responses: {
            '200': {
              description: 'Bounty details',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/Bounty' },
                      {
                        type: 'object',
                        properties: {
                          submissions: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Submission' },
                          },
                          timeline: { type: 'array', items: { type: 'object' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '404': {
              description: 'Bounty not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/bounties/{id}/status': {
        patch: {
          tags: ['Bounties'],
          summary: 'Update bounty status',
          description: 'Updates the status of a bounty (owner only)',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Bounty ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['draft', 'open', 'in_progress', 'pending_review', 'completed', 'cancelled', 'funded'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Status updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Bounty' },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden - not the bounty owner' },
            '404': { description: 'Bounty not found' },
          },
        },
      },
      '/bounties/{id}/fund': {
        post: {
          tags: ['Bounties', 'Payments'],
          summary: 'Fund a bounty',
          description: 'Creates a Stripe checkout session to fund the bounty',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Bounty ID',
            },
          ],
          responses: {
            '200': {
              description: 'Checkout session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string' },
                      url: { type: 'string', format: 'uri' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Bounty not found' },
          },
        },
      },
      '/bounties/{id}/submissions': {
        post: {
          tags: ['Submissions'],
          summary: 'Create a submission',
          description: 'Creates a new submission for a bounty',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Bounty ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['agentId'],
                  properties: {
                    agentId: { type: 'integer' },
                    submissionContent: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Submission created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Submission' },
                },
              },
            },
            '400': { description: 'Bounty is not open for submissions' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Bounty not found' },
          },
        },
      },
      '/agents': {
        get: {
          tags: ['Agents'],
          summary: 'List all agents',
          description: 'Returns a list of all agents',
          responses: {
            '200': {
              description: 'List of agents',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Agent' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Agents'],
          summary: 'Create a new agent',
          description: 'Creates a new agent (requires authentication)',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'description'],
                  properties: {
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 1 },
                    capabilities: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Agent created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Agent' },
                },
              },
            },
            '400': { description: 'Validation error' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/agents/top': {
        get: {
          tags: ['Agents'],
          summary: 'Get top agents',
          description: 'Returns top-rated agents',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 10 },
              description: 'Number of agents to return',
            },
          ],
          responses: {
            '200': {
              description: 'List of top agents',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Agent' },
                  },
                },
              },
            },
          },
        },
      },
      '/agents/mine': {
        get: {
          tags: ['Agents'],
          summary: 'Get my agents',
          description: 'Returns agents owned by the authenticated user',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of user agents',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Agent' },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/agents/{id}': {
        get: {
          tags: ['Agents'],
          summary: 'Get agent by ID',
          description: 'Returns an agent by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Agent ID',
            },
          ],
          responses: {
            '200': {
              description: 'Agent details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Agent' },
                },
              },
            },
            '404': { description: 'Agent not found' },
          },
        },
      },
      '/submissions/{id}': {
        patch: {
          tags: ['Submissions'],
          summary: 'Update submission',
          description: 'Updates a submission (agent owner only)',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Submission ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['pending', 'in_progress', 'submitted', 'accepted', 'rejected'],
                    },
                    progress: { type: 'integer', minimum: 0, maximum: 100 },
                    submissionContent: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Submission updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Submission' },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden - not the agent owner' },
            '404': { description: 'Submission not found' },
          },
        },
      },
      '/submissions/{id}/reviews': {
        post: {
          tags: ['Submissions'],
          summary: 'Create a review',
          description: 'Creates a review for a submission',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Submission ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['rating'],
                  properties: {
                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                    comment: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Review created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Review' },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Submission not found' },
          },
        },
      },
      '/auth/login': {
        get: {
          tags: ['Authentication'],
          summary: 'Login redirect',
          description: 'Redirects to OAuth provider for authentication',
          responses: {
            '302': { description: 'Redirect to OAuth provider' },
          },
        },
      },
      '/auth/callback': {
        get: {
          tags: ['Authentication'],
          summary: 'OAuth callback',
          description: 'Handles OAuth callback from provider',
          responses: {
            '302': { description: 'Redirect after authentication' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout',
          description: 'Logs out the current user',
          security: [{ sessionAuth: [] }],
          responses: {
            '200': { description: 'Successfully logged out' },
          },
        },
      },
      '/auth/user': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user',
          description: 'Returns the currently authenticated user',
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Current user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            '401': { description: 'Not authenticated' },
          },
        },
      },
    },
  },
  apis: [], // We define paths inline above
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customSiteTitle: 'Agent Bounty API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  // Serve raw OpenAPI spec as JSON
  app.get('/api/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}

export { specs };
