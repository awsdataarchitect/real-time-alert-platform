/**
 * Unit tests for the StrandsClient service
 */

const AWS = require('aws-sdk');
const { StrandsClient } = require('../../../../src/services/strands/StrandsClient');

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  return {
    BedrockRuntime: jest.fn(() => ({
      invokeModel: jest.fn().mockReturnThis(),
      promise: jest.fn()
    })),
    Lambda: jest.fn(() => ({
      invoke: jest.fn().mockReturnThis(),
      promise: jest.fn()
    }))
  };
});

describe('StrandsClient', () => {
  // Sample test data
  const mockContext = {
    currentAlert: {
      eventType: 'weather',
      subType: 'hurricane',
      severity: 8,
      headline: 'Hurricane Warning',
      description: 'Category 3 hurricane approaching with expected landfall in 24 hours.',
      location: {
        type: 'Point',
        coordinates: [-80.1918, 25.7617]
      },
      affectedAreas: [
        {
          areaId: 'area-123',
          areaName: 'Miami-Dade County',
          areaType: 'county'
        }
      ]
    },
    historicalAlerts: [
      {
        eventType: 'weather',
        subType: 'hurricane',
        severity: 7,
        headline: 'Previous Hurricane Warning',
        startTime: '2024-05-15T10:00:00Z',
        effectiveActions: [
          'Early evacuation of coastal areas',
          'Securing critical infrastructure'
        ],
        outcomes: [
          'Minimal casualties',
          'Significant property damage'
        ]
      }
    ],
    timestamp: '2025-06-22T12:00:00Z'
  };
  
  const mockLambdaResponse = {
    StatusCode: 200,
    Payload: JSON.stringify({
      statusCode: 200,
      body: JSON.stringify({
        recommendations: {
          general: [
            'Evacuate coastal areas immediately',
            'Secure property and belongings',
            'Prepare emergency supplies'
          ],
          specific: [
            'Move to designated hurricane shelters',
            'Follow evacuation routes provided by local authorities'
          ]
        },
        priorityLevel: 'high',
        timeframe: 'immediate',
        confidenceScore: 0.85,
        sources: ['Historical hurricane data', 'NOAA guidelines']
      })
    })
  };
  
  let strandsClient;
  let mockLambda;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up mock implementations
    mockLambda = {
      invoke: jest.fn().mockReturnThis(),
      promise: jest.fn().mockResolvedValue(mockLambdaResponse)
    };
    
    AWS.Lambda.mockImplementation(() => mockLambda);
    
    // Create a new StrandsClient instance for each test
    strandsClient = new StrandsClient({
      region: 'us-west-2',
      modelId: 'test-model-id'
    });
  });
  
  test('should initialize with default config values', () => {
    // Arrange
    const defaultClient = new StrandsClient();
    
    // Assert
    expect(defaultClient.config.region).toBe('us-west-2');
    expect(defaultClient.config.modelId).toBe('us.anthropic.claude-3-7-sonnet-20250219-v1:0');
  });
  
  test('should initialize with custom config values', () => {
    // Arrange
    const customClient = new StrandsClient({
      region: 'us-east-1',
      modelId: 'custom-model-id'
    });
    
    // Assert
    expect(customClient.config.region).toBe('us-east-1');
    expect(customClient.config.modelId).toBe('custom-model-id');
  });
  
  test('should successfully generate recommendations', async () => {
    // Act
    const result = await strandsClient.generateRecommendations(mockContext);
    
    // Assert
    expect(result).toHaveProperty('generalRecommendations');
    expect(result).toHaveProperty('specificActions');
    expect(result).toHaveProperty('priorityLevel', 'high');
    expect(result).toHaveProperty('timeframe', 'immediate');
    expect(result).toHaveProperty('confidenceScore', 0.85);
    expect(result).toHaveProperty('sources');
    expect(result).toHaveProperty('updatedAt');
    
    // Verify Lambda invocation
    expect(mockLambda.invoke).toHaveBeenCalled();
    const invokeParams = mockLambda.invoke.mock.calls[0][0];
    expect(invokeParams).toHaveProperty('FunctionName');
    expect(invokeParams).toHaveProperty('InvocationType', 'RequestResponse');
    
    // Verify payload structure
    const payload = JSON.parse(invokeParams.Payload);
    expect(payload).toHaveProperty('action', 'generateRecommendations');
    expect(payload).toHaveProperty('context', mockContext);
    expect(payload).toHaveProperty('config');
    expect(payload.config).toHaveProperty('modelId', 'test-model-id');
  });
  
  test('should throw an error when Lambda invocation fails', async () => {
    // Arrange
    mockLambda.promise.mockResolvedValue({
      StatusCode: 200,
      FunctionError: 'Unhandled',
      Payload: JSON.stringify({
        errorMessage: 'Lambda execution failed'
      })
    });
    
    // Act & Assert
    await expect(strandsClient.generateRecommendations(mockContext))
      .rejects
      .toThrow('Strands Agent Lambda error: Unhandled');
  });
  
  test('should throw an error when response structure is invalid', async () => {
    // Arrange
    mockLambda.promise.mockResolvedValue({
      StatusCode: 200,
      Payload: JSON.stringify({
        statusCode: 200,
        body: JSON.stringify({
          // Missing recommendations field
          priorityLevel: 'high'
        })
      })
    });
    
    // Act & Assert
    await expect(strandsClient.generateRecommendations(mockContext))
      .rejects
      .toThrow('Recommendations not found in Strands Agent response');
  });
  
  test('should throw an error when response body is missing', async () => {
    // Arrange
    mockLambda.promise.mockResolvedValue({
      StatusCode: 200,
      Payload: JSON.stringify({
        statusCode: 200
        // Missing body field
      })
    });
    
    // Act & Assert
    await expect(strandsClient.generateRecommendations(mockContext))
      .rejects
      .toThrow('Invalid response from Strands Agent');
  });
});