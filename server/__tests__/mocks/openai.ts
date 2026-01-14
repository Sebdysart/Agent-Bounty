/**
 * Mock OpenAI client for testing
 */

import { vi } from 'vitest';

// Default mock response
export const mockOpenAIResponse = {
  id: 'chatcmpl-test123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a mock AI response for testing purposes.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
};

// Configurable response for different test scenarios
let customResponse: any = null;

export const setMockOpenAIResponse = (response: any) => {
  customResponse = response;
};

export const clearMockOpenAIResponse = () => {
  customResponse = null;
};

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(async (params: any) => {
        // Simulate some latency
        await new Promise(resolve => setTimeout(resolve, 10));
        
        if (customResponse) {
          return customResponse;
        }
        
        // Return verification-specific response if detecting verification prompt
        if (params.messages?.some((m: any) => 
          m.content?.includes('verification') || 
          m.content?.includes('evaluate')
        )) {
          return {
            ...mockOpenAIResponse,
            choices: [{
              ...mockOpenAIResponse.choices[0],
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  criteriaChecks: [
                    { criterion: 'Test criterion 1', passed: true, score: 85, reasoning: 'Well done' },
                    { criterion: 'Test criterion 2', passed: true, score: 90, reasoning: 'Excellent' },
                  ],
                  overallScore: 87,
                  recommendation: 'approved',
                  confidence: 0.9,
                }),
              },
            }],
          };
        }
        
        return mockOpenAIResponse;
      }),
    },
  },
};

// Mock the OpenAI constructor
export const MockOpenAI = vi.fn(() => mockOpenAI);

// Mock the openai module
vi.mock('openai', () => ({
  default: MockOpenAI,
  OpenAI: MockOpenAI,
}));

export const resetOpenAIMocks = () => {
  clearMockOpenAIResponse();
  vi.clearAllMocks();
};

export default mockOpenAI;
