/**
 * Unit tests for user preference database queries
 */

const AWS = require('aws-sdk');
const {
  getUserPreferences,
  updateAlertPreferences,
  updateNotificationChannels,
  updateUserLocations,
  updateAccessibilityPreferences,
  subscribeToCategories,
  unsubscribeFromCategories
} = require('../../../../src/services/database/userPreferenceQueries');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

describe('User Preference Queries', () => {
  let documentClient;
  
  beforeEach(() => {
    // Get the mock document client
    documentClient = new AWS.DynamoDB.DocumentClient();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('getUserPreferences', () => {
    it('should get user preferences successfully', async () => {
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE']
        }
      };
      
      documentClient.promise.mockResolvedValue({ Item: mockUser });
      
      const result = await getUserPreferences('user123');
      
      expect(result).toEqual(mockUser);
      expect(documentClient.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'user123' },
        ProjectionExpression: expect.stringContaining('id')
      });
    });
    
    it('should return null if user not found', async () => {
      documentClient.promise.mockResolvedValue({});
      
      const result = await getUserPreferences('nonexistent-user');
      
      expect(result).toBeNull();
    });
    
    it('should throw error if database operation fails', async () => {
      documentClient.promise.mockRejectedValue(new Error('Database error'));
      
      await expect(getUserPreferences('user123')).rejects.toThrow('Database error');
    });
  });
  
  describe('updateAlertPreferences', () => {
    it('should update alert preferences successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 'MODERATE'
        }
      };
      
      documentClient.promise.mockResolvedValue({ Attributes: mockUpdatedUser });
      
      const alertPreferences = {
        categories: ['WEATHER', 'EARTHQUAKE'],
        minSeverity: 'MODERATE'
      };
      
      const result = await updateAlertPreferences('user123', alertPreferences);
      
      expect(result).toEqual(mockUpdatedUser);
      expect(documentClient.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'user123' },
        UpdateExpression: expect.stringContaining('alertPreferences'),
        ExpressionAttributeValues: expect.objectContaining({
          ':alertPreferences': alertPreferences
        }),
        ReturnValues: 'ALL_NEW'
      });
    });
    
    it('should throw error if database operation fails', async () => {
      documentClient.promise.mockRejectedValue(new Error('Database error'));
      
      await expect(updateAlertPreferences('user123', {})).rejects.toThrow('Database error');
    });
  });
  
  describe('updateNotificationChannels', () => {
    it('should update notification channels successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        notificationChannels: [
          {
            channelType: 'EMAIL',
            channelId: 'email@example.com',
            priority: 1,
            enabled: true
          }
        ]
      };
      
      documentClient.promise.mockResolvedValue({ Attributes: mockUpdatedUser });
      
      const notificationChannels = [
        {
          channelType: 'EMAIL',
          channelId: 'email@example.com',
          priority: 1,
          enabled: true
        }
      ];
      
      const result = await updateNotificationChannels('user123', notificationChannels);
      
      expect(result).toEqual(mockUpdatedUser);
      expect(documentClient.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'user123' },
        UpdateExpression: expect.stringContaining('notificationChannels'),
        ExpressionAttributeValues: expect.objectContaining({
          ':notificationChannels': notificationChannels
        }),
        ReturnValues: 'ALL_NEW'
      });
    });
  });
  
  describe('updateUserLocations', () => {
    it('should update user locations successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        locations: [
          {
            locationId: 'loc123',
            name: 'Home',
            type: 'HOME',
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194
            }
          }
        ]
      };
      
      documentClient.promise.mockResolvedValue({ Attributes: mockUpdatedUser });
      
      const locations = [
        {
          locationId: 'loc123',
          name: 'Home',
          type: 'HOME',
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194
          }
        }
      ];
      
      const result = await updateUserLocations('user123', locations);
      
      expect(result).toEqual(mockUpdatedUser);
      expect(documentClient.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'user123' },
        UpdateExpression: expect.stringContaining('locations'),
        ExpressionAttributeValues: expect.objectContaining({
          ':locations': expect.any(Array)
        }),
        ReturnValues: 'ALL_NEW'
      });
    });
    
    it('should generate locationId for new locations', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        locations: [
          {
            locationId: expect.stringMatching(/^loc_/),
            name: 'New Location',
            type: 'OTHER',
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194
            }
          }
        ]
      };
      
      documentClient.promise.mockResolvedValue({ Attributes: mockUpdatedUser });
      
      const locations = [
        {
          name: 'New Location',
          type: 'OTHER',
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194
          }
        }
      ];
      
      await updateUserLocations('user123', locations);
      
      const updateCall = documentClient.update.mock.calls[0][0];
      const updatedLocations = updateCall.ExpressionAttributeValues[':locations'];
      
      expect(updatedLocations[0].locationId).toMatch(/^loc_/);
    });
  });
  
  describe('updateAccessibilityPreferences', () => {
    it('should update accessibility preferences successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        profile: {
          accessibilityPreferences: {
            preferredFormat: 'large-text',
            textSize: 'large',
            colorScheme: 'high-contrast',
            audioEnabled: true
          }
        }
      };
      
      documentClient.promise.mockResolvedValue({ Attributes: mockUpdatedUser });
      
      const accessibilityPreferences = {
        preferredFormat: 'large-text',
        textSize: 'large',
        colorScheme: 'high-contrast',
        audioEnabled: true
      };
      
      const result = await updateAccessibilityPreferences('user123', accessibilityPreferences);
      
      expect(result).toEqual(mockUpdatedUser);
      expect(documentClient.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'user123' },
        UpdateExpression: expect.stringContaining('profile.accessibilityPreferences'),
        ExpressionAttributeValues: expect.objectContaining({
          ':accessibilityPreferences': accessibilityPreferences
        }),
        ReturnValues: 'ALL_NEW'
      });
    });
  });
  
  describe('subscribeToCategories', () => {
    it('should subscribe user to new categories', async () => {
      // Mock the getUserPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Item: {
          id: 'user123',
          alertPreferences: {
            categories: ['WEATHER']
          }
        }
      });
      
      // Mock the updateAlertPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Attributes: {
          id: 'user123',
          alertPreferences: {
            categories: ['WEATHER', 'EARTHQUAKE', 'FLOOD']
          }
        }
      });
      
      const result = await subscribeToCategories('user123', ['EARTHQUAKE', 'FLOOD']);
      
      expect(result.alertPreferences.categories).toEqual(['WEATHER', 'EARTHQUAKE', 'FLOOD']);
      expect(documentClient.get).toHaveBeenCalled();
      expect(documentClient.update).toHaveBeenCalled();
    });
    
    it('should handle subscribing to categories when user has no existing preferences', async () => {
      // Mock the getUserPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Item: {
          id: 'user123'
        }
      });
      
      // Mock the updateAlertPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Attributes: {
          id: 'user123',
          alertPreferences: {
            categories: ['WEATHER', 'EARTHQUAKE']
          }
        }
      });
      
      const result = await subscribeToCategories('user123', ['WEATHER', 'EARTHQUAKE']);
      
      expect(result.alertPreferences.categories).toEqual(['WEATHER', 'EARTHQUAKE']);
    });
    
    it('should throw error if user not found', async () => {
      documentClient.promise.mockResolvedValueOnce({ Item: null });
      
      await expect(subscribeToCategories('nonexistent-user', ['WEATHER'])).rejects.toThrow('User nonexistent-user not found');
    });
  });
  
  describe('unsubscribeFromCategories', () => {
    it('should unsubscribe user from categories', async () => {
      // Mock the getUserPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Item: {
          id: 'user123',
          alertPreferences: {
            categories: ['WEATHER', 'EARTHQUAKE', 'FLOOD']
          }
        }
      });
      
      // Mock the updateAlertPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Attributes: {
          id: 'user123',
          alertPreferences: {
            categories: ['WEATHER']
          }
        }
      });
      
      const result = await unsubscribeFromCategories('user123', ['EARTHQUAKE', 'FLOOD']);
      
      expect(result.alertPreferences.categories).toEqual(['WEATHER']);
      expect(documentClient.get).toHaveBeenCalled();
      expect(documentClient.update).toHaveBeenCalled();
    });
    
    it('should handle unsubscribing when user has no categories', async () => {
      // Mock the getUserPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Item: {
          id: 'user123',
          alertPreferences: {}
        }
      });
      
      // Mock the updateAlertPreferences call
      documentClient.promise.mockResolvedValueOnce({
        Attributes: {
          id: 'user123',
          alertPreferences: {
            categories: []
          }
        }
      });
      
      const result = await unsubscribeFromCategories('user123', ['WEATHER']);
      
      expect(result.alertPreferences.categories).toEqual([]);
    });
    
    it('should throw error if user not found', async () => {
      documentClient.promise.mockResolvedValueOnce({ Item: null });
      
      await expect(unsubscribeFromCategories('nonexistent-user', ['WEATHER'])).rejects.toThrow('User nonexistent-user not found');
    });
  });
});