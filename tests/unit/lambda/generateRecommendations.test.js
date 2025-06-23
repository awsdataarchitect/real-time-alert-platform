/**
 * Unit tests for the generateRecommendations Lambda function
 */

const AWS = require('aws-sdk');
const { handler } = require('../../../src/lambda/generateRecommendations');
const { StrandsClient } = require('../../../src/services/strands/StrandsClient');
const { getAlertById, getRelatedHistoricalAlerts } = require('../../../src/services/database/alertQueries');
const { saveRecommendation } = require('../../../src/services/database/recommendationQueries');

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    Lambda: jest.fn(() => ({
      invoke: jest.fn().mockReturnThis(),
      promise: jest.fn()
    })),
    BedrockRuntime: jest.fn(() => ({
      invokeModel: jest.fn().mockReturnThis(),
      promise: jest.fn()
    }))
  };
});

// Mock the database functions
jest.mock('../../../src/services/database/alertQueries', () => ({
  getAlertById: jest.fn(),
  getRelatedHistoricalAlerts: jest.fn()
}));

jest.mock('../../../src/services/database/recommendationQueries', () => ({
  saveRecommendation: jest.fn()
}));

// Mock the StrandsClient
jest.mock('../../../src/services/strands/StrandsClient', () => ({
  StrandsClient: jest.fn().mockImplementation(() => ({
    generateRecommendations: jest.fn()
  }))
}));

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

describe('generateRecommendations Lambda', () => {
  // Sample test data
  const mockAlert = {
    alertId: 'test-alert-123',
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
    ],
    createdAt: '2025-06-20T10:00:00Z'
  };
  
  const mockHistoricalAlerts = [
    {
      alertId: 'hist-alert-1',
      eventType: 'weather',
      subType: 'hurricane',
      severity: 7,
      headline: 'Previous Hurricane Warning',
      createdAt: '2024-05-15T10:00:00Z',
      effectiveActions: [
        'Early evacuation of coastal areas',
        'Securing critical infrastructure'
      ],
      outcomes: [
        'Minimal casualties',
        'Significant property damage'
      ]
    }
  ];
  
  const mockRecommendations = {
    generalRecommendations: [
      'Evacuate coastal areas immediately',
      'Secure property and belongings',
      'Prepare emergency supplies'
    ],
    specificActions: [
      'Move to designated hurricane shelters',
      'Follow evacuation routes provided by local authorities'
    ],
    priorityLevel: 'high',
    timeframe: 'immediate',
    confidenceScore: 0.85,
    sources: ['Historical hurricane data', 'NOAA guidelines'],
    updatedAt: '2025-06-22T12:00:00Z'
  };
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up mock implementations
    getAlertById.mockResolvedValue(mockAlert);
    getRelatedHistoricalAlerts.mockResolvedValue(mockHistoricalAlerts);
    
    // Mock StrandsClient implementation
    StrandsClient.mockImplementation(() => ({
      generateRecommendations: jest.fn().mockResolvedValue(mockRecommendations)
    }));
    
    // Mock saveRecommendation
    saveRecommendation.mockResolvedValue({
      recommendationId: 'mock-uuid',
      alertId: mockAlert.alertId,
      recommendations: mockRecommendations
    });
  });
  
  test('should successfully generate recommendations for a valid alert', async () => {
    // Arrange
    const event = {
      alertId: 'test-alert-123'
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('recommendationId', 'mock-uuid');
    expect(JSON.parse(result.body)).toHaveProperty('recommendations', mockRecommendations);
    
    // Verify function calls
    expect(getAlertById).toHaveBeenCalledWith('test-alert-123');
    expect(getRelatedHistoricalAlerts).toHaveBeenCalledWith(mockAlert);
    expect(saveRecommendation).toHaveBeenCalled();
  });
  
  test('should return an error when no alert ID is provided', async () => {
    // Arrange
    const event = {};
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Alert ID is required');
    
    // Verify function calls
    expect(getAlertById).not.toHaveBeenCalled();
    expect(getRelatedHistoricalAlerts).not.toHaveBeenCalled();
    expect(saveRecommendation).not.toHaveBeenCalled();
  });
  
  test('should return an error when alert is not found', async () => {
    // Arrange
    const event = {
      alertId: 'non-existent-alert'
    };
    
    // Mock getAlertById to return null
    getAlertById.mockResolvedValue(null);
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Alert with ID non-existent-alert not found');
    
    // Verify function calls
    expect(getAlertById).toHaveBeenCalledWith('non-existent-alert');
    expect(getRelatedHistoricalAlerts).not.toHaveBeenCalled();
    expect(saveRecommendation).not.toHaveBeenCalled();
  });
  
  test('should handle Strands Agent errors and provide fallback recommendations', async () => {
    // Arrange
    const event = {
      alertId: 'test-alert-123'
    };
    
    // Mock StrandsClient to throw an error
    StrandsClient.mockImplementation(() => ({
      generateRecommendations: jest.fn().mockRejectedValue(new Error('Strands Agent error'))
    }));
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('recommendationId', 'mock-uuid');
    expect(body.recommendations).toHaveProperty('generalRecommendations');
    expect(body.recommendations).toHaveProperty('confidenceScore', 0.5); // Fallback confidence score
    
    // Verify function calls
    expect(getAlertById).toHaveBeenCalledWith('test-alert-123');
    expect(getRelatedHistoricalAlerts).toHaveBeenCalledWith(mockAlert);
    expect(saveRecommendation).toHaveBeenCalled();
  });
  
  test('should prepare proper context for Strands Agent', async () => {
    // Arrange
    const event = {
      alertId: 'test-alert-123'
    };
    
    // Create a spy on the StrandsClient instance
    const strandsClientInstance = {
      generateRecommendations: jest.fn().mockResolvedValue(mockRecommendations)
    };
    StrandsClient.mockImplementation(() => strandsClientInstance);
    
    // Act
    await handler(event);
    
    // Assert
    expect(strandsClientInstance.generateRecommendations).toHaveBeenCalled();
    const context = strandsClientInstance.generateRecommendations.mock.calls[0][0];
    
    // Verify context structure
    expect(context).toHaveProperty('currentAlert');
    expect(context).toHaveProperty('historicalAlerts');
    expect(context.currentAlert).toHaveProperty('eventType', 'weather');
    expect(context.currentAlert).toHaveProperty('subType', 'hurricane');
    expect(context.currentAlert).toHaveProperty('severity', 8);
    expect(context.historicalAlerts).toBeInstanceOf(Array);
    expect(context.historicalAlerts.length).toBe(1);
  });
});