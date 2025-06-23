/**
 * Unit tests for personalizeAlerts Lambda function
 */

import { 
  getUserContext, 
  getAlertContext, 
  generatePersonalizedContent, 
  determineRelevance, 
  calculateDistance, 
  getTemplatePrompt, 
  storePersonalizedAlert, 
  processPersonalization, 
  processBatchPersonalization, 
  handler 
} from '../../../src/lambda/personalizeAlerts';

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    scan: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock the AWS SDK v3 Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntime: jest.fn().mockImplementation(() => {
      return {
        invokeModel: jest.fn().mockResolvedValue({
          body: Buffer.from(JSON.stringify({
            content: [
              {
                text: `{
                  "headline": "Personalized Alert: Severe Weather Warning",
                  "shortMessage": "A severe thunderstorm is approaching your area. Take shelter now.",
                  "detailedMessage": "A severe thunderstorm with potential for flash flooding is moving toward your location in Springfield. Expected arrival in 30 minutes.",
                  "personalizedInstructions": "Based on your location in Springfield, move to higher ground and stay indoors.",
                  "relevanceExplanation": "This alert is highly relevant as it directly impacts your primary location.",
                  "additionalContext": "Similar storms in this area have caused power outages and minor flooding."
                }`
              }
            ]
          }))
        })
      };
    })
  };
});

// Mock the database query functions
jest.mock('../../../src/services/database/userPreferenceQueries', () => ({
  getUserPreferences: jest.fn()
}));

jest.mock('../../../src/services/database/alertQueries', () => ({
  getAlertById: jest.fn(),
  getRelatedHistoricalAlerts: jest.fn()
}));

// Import the mocked functions
import { getUserPreferences } from '../../../src/services/database/userPreferenceQueries';
import { getAlertById, getRelatedHistoricalAlerts } from '../../../src/services/database/alertQueries';

// Mock DynamoDB DocumentClient
const mockDynamoDBClient = new (require('aws-sdk')).DynamoDB.DocumentClient();

describe('personalizeAlerts Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUserContext', () => {
    test('should return user context when user exists', async () => {
      // Mock user preferences
      const mockUser = {
        id: 'user123',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        notificationChannels: [
          { channelType: 'EMAIL', channelId: 'user@example.com', priority: 1 }
        ],
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 50
          }
        ],
        profile: {
          language: 'en',
          accessibilityPreferences: {
            preferredFormat: 'text',
            simplifiedLanguage: false
          }
        }
      };
      
      getUserPreferences.mockResolvedValue(mockUser);
      
      const result = await getUserContext('user123');
      
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
      expect(result).toEqual({
        userId: 'user123',
        alertPreferences: mockUser.alertPreferences,
        notificationChannels: mockUser.notificationChannels,
        locations: mockUser.locations,
        profile: mockUser.profile
      });
    });
    
    test('should throw error when user does not exist', async () => {
      getUserPreferences.mockResolvedValue(null);
      
      await expect(getUserContext('nonexistent')).rejects.toThrow('User with ID nonexistent not found');
      expect(getUserPreferences).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('getAlertContext', () => {
    test('should return alert context when alert exists', async () => {
      // Mock alert
      const mockAlert = {
        alertId: 'alert123',
        eventType: 'WEATHER',
        headline: 'Severe Thunderstorm Warning',
        description: 'A severe thunderstorm is approaching',
        severity: 8,
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      // Mock related alerts
      const mockRelatedAlerts = [
        {
          alertId: 'alert456',
          eventType: 'WEATHER',
          headline: 'Flash Flood Warning',
          description: 'Flash flooding possible in low-lying areas',
          severity: 7,
          createdAt: '2025-06-21T12:00:00Z'
        }
      ];
      
      getAlertById.mockResolvedValue(mockAlert);
      getRelatedHistoricalAlerts.mockResolvedValue(mockRelatedAlerts);
      
      const result = await getAlertContext('alert123');
      
      expect(getAlertById).toHaveBeenCalledWith('alert123');
      expect(getRelatedHistoricalAlerts).toHaveBeenCalledWith(mockAlert, 3);
      expect(result).toEqual({
        alert: mockAlert,
        relatedHistoricalAlerts: mockRelatedAlerts
      });
    });
    
    test('should throw error when alert does not exist', async () => {
      getAlertById.mockResolvedValue(null);
      
      await expect(getAlertContext('nonexistent')).rejects.toThrow('Alert with ID nonexistent not found');
      expect(getAlertById).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('generatePersonalizedContent', () => {
    test('should generate personalized content successfully', async () => {
      // Mock user context
      const mockUserContext = {
        userId: 'user123',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 50
          }
        ],
        profile: {
          language: 'en',
          accessibilityPreferences: {
            preferredFormat: 'text',
            simplifiedLanguage: false
          }
        }
      };
      
      // Mock alert context
      const mockAlertContext = {
        alert: {
          alertId: 'alert123',
          eventType: 'WEATHER',
          headline: 'Severe Thunderstorm Warning',
          description: 'A severe thunderstorm is approaching',
          severity: 8,
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749]
          }
        },
        relatedHistoricalAlerts: [
          {
            alertId: 'alert456',
            eventType: 'WEATHER',
            headline: 'Flash Flood Warning',
            description: 'Flash flooding possible in low-lying areas',
            severity: 7,
            createdAt: '2025-06-21T12:00:00Z'
          }
        ]
      };
      
      const result = await generatePersonalizedContent(mockUserContext, mockAlertContext);
      
      expect(result).toHaveProperty('headline');
      expect(result).toHaveProperty('shortMessage');
      expect(result).toHaveProperty('detailedMessage');
      expect(result).toHaveProperty('personalizedInstructions');
      expect(result).toHaveProperty('relevanceExplanation');
      expect(result).toHaveProperty('additionalContext');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('templateType');
    });
  });
  
  describe('determineRelevance', () => {
    test('should return true when alert is relevant to user', () => {
      const alert = {
        eventType: 'WEATHER',
        severity: 8,
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const userContext = {
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 50
          }
        ]
      };
      
      const result = determineRelevance(alert, userContext);
      expect(result).toBe(true);
    });
    
    test('should return false when alert category is not in user preferences', () => {
      const alert = {
        eventType: 'TSUNAMI',
        severity: 8,
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const userContext = {
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 50
          }
        ]
      };
      
      const result = determineRelevance(alert, userContext);
      expect(result).toBe(false);
    });
    
    test('should return false when alert severity is below user threshold', () => {
      const alert = {
        eventType: 'WEATHER',
        severity: 2,
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const userContext = {
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 50
          }
        ]
      };
      
      const result = determineRelevance(alert, userContext);
      expect(result).toBe(false);
    });
    
    test('should return false when alert location is too far from user locations', () => {
      const alert = {
        eventType: 'WEATHER',
        severity: 8,
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128] // New York coordinates
        }
      };
      
      const userContext = {
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 3
        },
        locations: [
          { 
            locationId: 'loc1', 
            name: 'Home', 
            coordinates: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco coordinates
            radius: 50
          }
        ]
      };
      
      const result = determineRelevance(alert, userContext);
      expect(result).toBe(false);
    });
  });
  
  describe('calculateDistance', () => {
    test('should calculate distance between two points correctly', () => {
      // New York to Los Angeles ~3,944 km
      const distance = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });
    
    test('should return 0 for identical points', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });
  });
  
  describe('getTemplatePrompt', () => {
    test('should return standard template prompt by default', () => {
      const prompt = getTemplatePrompt('standard', false, 'text');
      expect(prompt).toContain('You are an emergency alert system that personalizes alerts for users.');
      expect(prompt).toContain('Create a balanced alert with essential information and clear instructions.');
      expect(prompt).toContain('Format the content for clear reading on digital devices.');
    });
    
    test('should include simplified language instructions when needed', () => {
      const prompt = getTemplatePrompt('standard', true, 'text');
      expect(prompt).toContain('Use simple, clear language.');
      expect(prompt).toContain('Avoid complex sentences, technical terms, and jargon.');
    });
    
    test('should include audio format instructions when needed', () => {
      const prompt = getTemplatePrompt('standard', false, 'audio');
      expect(prompt).toContain('Format the content to be easily read aloud by text-to-speech systems.');
    });
    
    test('should include brief template instructions when specified', () => {
      const prompt = getTemplatePrompt('brief', false, 'text');
      expect(prompt).toContain('Create a very concise alert that conveys only the most critical information.');
    });
  });
  
  describe('storePersonalizedAlert', () => {
    test('should store personalized alert in DynamoDB', async () => {
      const alertId = 'alert123';
      const userId = 'user123';
      const personalizedContent = {
        headline: 'Personalized Alert',
        shortMessage: 'Test message'
      };
      
      mockDynamoDBClient.put().promise.mockResolvedValue({});
      
      const result = await storePersonalizedAlert(alertId, userId, personalizedContent);
      
      expect(mockDynamoDBClient.put).toHaveBeenCalled();
      expect(result).toEqual({
        personalizedAlertId: `${alertId}_${userId}`,
        alertId,
        userId,
        personalizedContent
      });
    });
  });
  
  describe('processPersonalization', () => {
    test('should process personalization successfully', async () => {
      // Mock user context
      const mockUserContext = {
        userId: 'user123',
        alertPreferences: {
          categories: ['WEATHER'],
          minSeverity: 3
        },
        locations: [{ name: 'Home' }],
        profile: { language: 'en' }
      };
      
      // Mock alert context
      const mockAlertContext = {
        alert: {
          alertId: 'alert123',
          eventType: 'WEATHER',
          headline: 'Test Alert'
        },
        relatedHistoricalAlerts: []
      };
      
      // Mock personalized content
      const mockPersonalizedContent = {
        headline: 'Personalized Alert',
        shortMessage: 'Test message'
      };
      
      // Mock functions
      jest.spyOn(global, 'getUserContext').mockResolvedValue(mockUserContext);
      jest.spyOn(global, 'getAlertContext').mockResolvedValue(mockAlertContext);
      jest.spyOn(global, 'generatePersonalizedContent').mockResolvedValue(mockPersonalizedContent);
      jest.spyOn(global, 'storePersonalizedAlert').mockResolvedValue({
        personalizedAlertId: 'alert123_user123',
        alertId: 'alert123',
        userId: 'user123',
        personalizedContent: mockPersonalizedContent
      });
      
      const result = await processPersonalization('alert123', 'user123');
      
      expect(result).toEqual({
        status: 'success',
        personalizedAlert: {
          personalizedAlertId: 'alert123_user123',
          alertId: 'alert123',
          userId: 'user123',
          personalizedContent: mockPersonalizedContent
        }
      });
    });
    
    test('should handle errors during personalization', async () => {
      jest.spyOn(global, 'getUserContext').mockRejectedValue(new Error('Test error'));
      
      const result = await processPersonalization('alert123', 'user123');
      
      expect(result).toEqual({
        status: 'error',
        alertId: 'alert123',
        userId: 'user123',
        error: 'Test error'
      });
    });
  });
  
  describe('processBatchPersonalization', () => {
    test('should process batch personalization successfully', async () => {
      // Mock processPersonalization to return success for first user and error for second
      jest.spyOn(global, 'processPersonalization')
        .mockResolvedValueOnce({
          status: 'success',
          personalizedAlert: { personalizedAlertId: 'alert123_user1' }
        })
        .mockResolvedValueOnce({
          status: 'error',
          alertId: 'alert123',
          userId: 'user2',
          error: 'Test error'
        });
      
      const result = await processBatchPersonalization('alert123', ['user1', 'user2']);
      
      expect(result).toEqual({
        total: 2,
        successful: 1,
        failed: 1,
        details: [
          {
            status: 'success',
            personalizedAlert: { personalizedAlertId: 'alert123_user1' }
          },
          {
            status: 'error',
            alertId: 'alert123',
            userId: 'user2',
            error: 'Test error'
          }
        ]
      });
    });
  });
  
  describe('handler', () => {
    test('should handle single user personalization', async () => {
      // Mock processPersonalization
      jest.spyOn(global, 'processPersonalization').mockResolvedValue({
        status: 'success',
        personalizedAlert: { personalizedAlertId: 'alert123_user123' }
      });
      
      const event = {
        alertId: 'alert123',
        userId: 'user123',
        templateType: 'standard'
      };
      
      const result = await handler(event);
      
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Personalized alert generated successfully',
          result: {
            status: 'success',
            personalizedAlert: { personalizedAlertId: 'alert123_user123' }
          }
        })
      });
    });
    
    test('should handle batch personalization', async () => {
      // Mock processBatchPersonalization
      jest.spyOn(global, 'processBatchPersonalization').mockResolvedValue({
        total: 2,
        successful: 2,
        failed: 0,
        details: []
      });
      
      const event = {
        alertId: 'alert123',
        userIds: ['user1', 'user2'],
        templateType: 'standard'
      };
      
      const result = await handler(event);
      
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Batch personalization processing completed',
          results: {
            total: 2,
            successful: 2,
            failed: 0,
            details: []
          }
        })
      });
    });
    
    test('should return error when alertId is missing', async () => {
      const event = {
        userId: 'user123'
      };
      
      const result = await handler(event);
      
      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Alert ID is required'
        })
      });
    });
    
    test('should return error when both userId and userIds are missing', async () => {
      const event = {
        alertId: 'alert123'
      };
      
      const result = await handler(event);
      
      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Either userId or userIds array is required'
        })
      });
    });
  });
});