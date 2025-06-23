/**
 * Integration tests for webhook endpoints
 * 
 * These tests verify that the webhook endpoints correctly handle incoming data,
 * authenticate requests, apply rate limiting, and create alerts in the system.
 */

import { handler } from '../../src/lambda/webhookHandler';
import AWS from 'aws-sdk-mock';
import { v4 as uuidv4 } from 'uuid';

// Mock AWS services
jest.mock('uuid');

describe('Webhook Endpoints Integration Tests', () => {
  beforeEach(() => {
    // Mock UUID generation to return predictable values
    uuidv4.mockReturnValue('test-uuid');
    
    // Mock AWS services
    AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, { Item: params.Item });
    });
    
    AWS.mock('SecretsManager', 'getSecretValue', (params, callback) => {
      const secretData = {
        'test-api-key': {
          active: true,
          name: 'Test API Key',
          source: 'test-source'
        },
        'inactive-key': {
          active: false,
          name: 'Inactive Key',
          source: 'test-source'
        }
      };
      
      callback(null, {
        SecretString: JSON.stringify(secretData)
      });
    });
    
    // Set environment variables
    process.env.API_KEYS_SECRET_NAME = 'webhook-api-keys';
    process.env.ALERTS_TABLE_NAME = 'alerts-table';
    process.env.RATE_LIMIT_MAX_REQUESTS = '5';
    process.env.RATE_LIMIT_TIME_WINDOW = '60000';
  });
  
  afterEach(() => {
    // Restore AWS mocks
    AWS.restore();
    jest.clearAllMocks();
    delete process.env.API_KEYS_SECRET_NAME;
    delete process.env.ALERTS_TABLE_NAME;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_TIME_WINDOW;
  });
  
  test('should process valid webhook data and create alert', async () => {
    // Create test event
    const event = {
      body: JSON.stringify({
        sourceId: 'test-source',
        sourceType: 'TEST',
        category: 'WEATHER',
        eventType: 'TEST_EVENT',
        severity: 'MODERATE',
        certainty: 'OBSERVED',
        headline: 'Test Alert',
        description: 'This is a test alert',
        startTime: '2023-01-01T00:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [10, 20]
        }
      }),
      headers: {
        'x-api-key': 'test-api-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // Call handler
    const response = await handler(event);
    
    // Verify response
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toEqual(expect.objectContaining({
      id: 'test-uuid',
      sourceId: 'test-source',
      sourceType: 'TEST',
      category: 'WEATHER',
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert'
    }));
  });
  
  test('should process batch of alerts', async () => {
    // Create test event with batch of alerts
    const event = {
      body: JSON.stringify({
        alerts: [
          {
            sourceId: 'test-source',
            sourceType: 'TEST',
            category: 'WEATHER',
            eventType: 'TEST_EVENT_1',
            severity: 'MODERATE',
            certainty: 'OBSERVED',
            headline: 'Test Alert 1',
            description: 'This is test alert 1',
            startTime: '2023-01-01T00:00:00Z',
            status: 'ACTIVE',
            location: {
              type: 'Point',
              coordinates: [10, 20]
            }
          },
          {
            sourceId: 'test-source',
            sourceType: 'TEST',
            category: 'WEATHER',
            eventType: 'TEST_EVENT_2',
            severity: 'MINOR',
            certainty: 'POSSIBLE',
            headline: 'Test Alert 2',
            description: 'This is test alert 2',
            startTime: '2023-01-01T00:00:00Z',
            status: 'ACTIVE',
            location: {
              type: 'Point',
              coordinates: [30, 40]
            }
          }
        ]
      }),
      headers: {
        'x-api-key': 'test-api-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // Call handler
    const response = await handler(event);
    
    // Verify response
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual(expect.objectContaining({
      eventType: 'TEST_EVENT_1',
      headline: 'Test Alert 1'
    }));
    expect(body.results[1]).toEqual(expect.objectContaining({
      eventType: 'TEST_EVENT_2',
      headline: 'Test Alert 2'
    }));
  });
  
  test('should reject request with invalid API key', async () => {
    // Create test event with invalid API key
    const event = {
      body: JSON.stringify({
        sourceId: 'test-source',
        sourceType: 'TEST',
        category: 'WEATHER',
        eventType: 'TEST_EVENT',
        severity: 'MODERATE',
        certainty: 'OBSERVED',
        headline: 'Test Alert',
        description: 'This is a test alert',
        startTime: '2023-01-01T00:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [10, 20]
        }
      }),
      headers: {
        'x-api-key': 'invalid-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // Call handler
    const response = await handler(event);
    
    // Verify response
    expect(response.statusCode).toBe(401);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid API key');
  });
  
  test('should reject request with inactive API key', async () => {
    // Create test event with inactive API key
    const event = {
      body: JSON.stringify({
        sourceId: 'test-source',
        sourceType: 'TEST',
        category: 'WEATHER',
        eventType: 'TEST_EVENT',
        severity: 'MODERATE',
        certainty: 'OBSERVED',
        headline: 'Test Alert',
        description: 'This is a test alert',
        startTime: '2023-01-01T00:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [10, 20]
        }
      }),
      headers: {
        'x-api-key': 'inactive-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // Call handler
    const response = await handler(event);
    
    // Verify response
    expect(response.statusCode).toBe(401);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid API key');
  });
  
  test('should apply rate limiting', async () => {
    // Mock rate limiting in the WebhookConnector
    const mockIsRateLimited = jest.fn()
      .mockReturnValueOnce(false) // First call not rate limited
      .mockReturnValueOnce(true); // Second call rate limited
    
    jest.mock('../../src/services/connectors/WebhookConnector', () => {
      return {
        WebhookConnector: jest.fn().mockImplementation(() => {
          return {
            isRateLimited: mockIsRateLimited,
            processWebhookData: jest.fn().mockImplementation(() => {
              if (mockIsRateLimited()) {
                throw new Error('Rate limit exceeded');
              }
              return {
                sourceId: 'test-source',
                sourceType: 'TEST',
                category: 'WEATHER',
                eventType: 'TEST_EVENT',
                severity: 'MODERATE',
                headline: 'Test Alert',
                description: 'This is a test alert'
              };
            })
          };
        })
      };
    });
    
    // Create test event
    const event = {
      body: JSON.stringify({
        sourceId: 'test-source',
        sourceType: 'TEST',
        category: 'WEATHER',
        eventType: 'TEST_EVENT',
        severity: 'MODERATE',
        certainty: 'OBSERVED',
        headline: 'Test Alert',
        description: 'This is a test alert',
        startTime: '2023-01-01T00:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [10, 20]
        }
      }),
      headers: {
        'x-api-key': 'test-api-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // First call should succeed
    const response1 = await handler(event);
    expect(response1.statusCode).toBe(200);
    
    // Second call should be rate limited
    const response2 = await handler(event);
    expect(response2.statusCode).toBe(429);
    expect(response2.headers['Retry-After']).toBe('60');
    
    const body = JSON.parse(response2.body);
    expect(body.error).toBe('Rate limit exceeded');
  });
  
  test('should handle invalid data', async () => {
    // Create test event with invalid data
    const event = {
      body: JSON.stringify({
        // Missing required fields
        sourceId: 'test-source',
        sourceType: 'TEST'
      }),
      headers: {
        'x-api-key': 'test-api-key'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      }
    };
    
    // Mock WebhookConnector to throw validation error
    jest.mock('../../src/services/connectors/WebhookConnector', () => {
      return {
        WebhookConnector: jest.fn().mockImplementation(() => {
          return {
            isRateLimited: jest.fn().mockReturnValue(false),
            processWebhookData: jest.fn().mockImplementation(() => {
              throw new Error('Invalid data: Missing required fields');
            })
          };
        })
      };
    });
    
    // Call handler
    const response = await handler(event);
    
    // Verify response
    expect(response.statusCode).toBe(500);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Internal server error');
  });
});