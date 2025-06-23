const AWS = require('aws-sdk');
const { handler } = require('../../../src/lambda/accessibilityAdaptations');

// Mock AWS services
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  const mockBedrockRuntime = {
    invokeModel: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    BedrockRuntime: jest.fn(() => mockBedrockRuntime)
  };
});

describe('accessibilityAdaptations Lambda', () => {
  let mockDynamoDBClient;
  let mockBedrockClient;
  
  beforeEach(() => {
    // Reset environment variables
    process.env.ALERTS_TABLE = 'test-alerts-table';
    process.env.USERS_TABLE = 'test-users-table';
    process.env.ACCESSIBILITY_ADAPTATIONS_TABLE = 'test-adaptations-table';
    
    // Get mock instances
    mockDynamoDBClient = new AWS.DynamoDB.DocumentClient();
    mockBedrockClient = new AWS.BedrockRuntime();
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  test('should return early if user has no accessibility preferences', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
            // No accessibility preferences
          }
        }
      });
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body.adaptations).toEqual([]);
    expect(result.body.message).toBe('No accessibility adaptations needed');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoDBClient.put).not.toHaveBeenCalled();
  });
  
  test('should process text-to-speech adaptation', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
            language: 'en',
            accessibilityPreferences: {
              audioEnabled: true
            }
          }
        }
      })
      // Third call - saveAdaptations
      .mockResolvedValueOnce({});
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body.adaptations).toHaveLength(1);
    expect(result.body.adaptations[0].type).toBe('text-to-speech');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoDBClient.put).toHaveBeenCalledTimes(1);
  });
  
  test('should process multiple adaptations based on user preferences', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
            language: 'es', // Spanish
            accessibilityPreferences: {
              audioEnabled: true,
              preferredFormat: 'bullet-points',
              colorScheme: 'high-contrast',
              textSize: 'large',
              additionalNeeds: ['simplified-language']
            }
          }
        }
      })
      // Third call - saveAdaptations
      .mockResolvedValueOnce({});
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body.adaptations).toHaveLength(6); // All adaptation types
    
    // Check that all expected adaptation types are present
    const adaptationTypes = result.body.adaptations.map(a => a.type);
    expect(adaptationTypes).toContain('text-to-speech');
    expect(adaptationTypes).toContain('format-conversion');
    expect(adaptationTypes).toContain('visual-adaptation');
    expect(adaptationTypes).toContain('text-size-adaptation');
    expect(adaptationTypes).toContain('simplified-language');
    expect(adaptationTypes).toContain('language-translation');
    
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoDBClient.put).toHaveBeenCalledTimes(1);
  });
  
  test('should handle missing alert gracefully', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert (not found)
      .mockResolvedValueOnce({
        // No Item returned
      });
    
    const event = {
      alertId: 'non-existent-alert',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toContain('Alert not found');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(1);
  });
  
  test('should handle missing user gracefully', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser (not found)
      .mockResolvedValueOnce({
        // No Item returned
      });
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'non-existent-user'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toContain('User not found');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
  });
  
  test('should handle missing required parameters', async () => {
    const event = {
      // Missing alertId and userId
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toContain('Missing required parameters');
    expect(mockDynamoDBClient.get).not.toHaveBeenCalled();
  });
  
  test('should handle format conversion adaptation', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
            accessibilityPreferences: {
              preferredFormat: 'bullet-points'
            }
          }
        }
      })
      // Third call - saveAdaptations
      .mockResolvedValueOnce({});
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body.adaptations).toHaveLength(1);
    expect(result.body.adaptations[0].type).toBe('format-conversion');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoDBClient.put).toHaveBeenCalledTimes(1);
  });
  
  test('should handle language translation adaptation', async () => {
    // Mock DynamoDB responses
    mockDynamoDBClient.promise
      // First call - getAlert
      .mockResolvedValueOnce({
        Item: {
          alertId: 'test-alert-1',
          headline: 'Test Alert',
          description: 'This is a test alert',
          instructions: 'Stay indoors',
          severity: 8,
          eventType: 'weather'
        }
      })
      // Second call - getUser
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
            language: 'fr', // French
            accessibilityPreferences: {
              // Empty but exists
            }
          }
        }
      })
      // Third call - saveAdaptations
      .mockResolvedValueOnce({});
    
    const event = {
      alertId: 'test-alert-1',
      userId: 'user-1'
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    expect(result.body.adaptations).toHaveLength(1);
    expect(result.body.adaptations[0].type).toBe('language-translation');
    expect(mockDynamoDBClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoDBClient.put).toHaveBeenCalledTimes(1);
  });
});