/**
 * Unit tests for user preference management Lambda function
 */

import {
  handler,
  updateUserAlertPreferences,
  updateUserNotificationChannels,
  updateUserLocationsHandler,
  updateUserAccessibilityPreferences,
  subscribeUserToCategories,
  unsubscribeUserFromCategories,
  getUserPreferencesHandler
} from '../../../src/lambda/userPreferenceManagement';

// Mock the validation functions
jest.mock('../../../src/utils/userValidation', () => ({
  validateAlertPreferences: jest.fn(),
  validateNotificationChannels: jest.fn(),
  validateUserLocations: jest.fn(),
  validateAccessibilityPreferences: jest.fn()
}));

// Mock the database query functions
jest.mock('../../../src/services/database/userPreferenceQueries', () => ({
  getUserPreferences: jest.fn(),
  updateAlertPreferences: jest.fn(),
  updateNotificationChannels: jest.fn(),
  updateUserLocations: jest.fn(),
  updateAccessibilityPreferences: jest.fn(),
  subscribeToCategories: jest.fn(),
  unsubscribeFromCategories: jest.fn()
}));

// Import the mocked functions
import {
  validateAlertPreferences,
  validateNotificationChannels,
  validateUserLocations,
  validateAccessibilityPreferences
} from '../../../src/utils/userValidation';

import {
  getUserPreferences,
  updateAlertPreferences,
  updateNotificationChannels,
  updateUserLocations,
  updateAccessibilityPreferences,
  subscribeToCategories,
  unsubscribeFromCategories
} from '../../../src/services/database/userPreferenceQueries';

describe('User Preference Management Lambda', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('updateUserAlertPreferences', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          alertPreferences: {}
        })
      };

      const response = await updateUserAlertPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if alertPreferences is missing', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123'
        })
      };

      const response = await updateUserAlertPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Alert preferences are required');
    });

    it('should return 400 if alertPreferences validation fails', async () => {
      validateAlertPreferences.mockReturnValue({
        isValid: false,
        errors: ['Invalid category']
      });

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          alertPreferences: {
            categories: ['INVALID_CATEGORY']
          }
        })
      };

      const response = await updateUserAlertPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid alert preferences');
      expect(JSON.parse(response.body).errors).toContain('Invalid category');
    });

    it('should update alert preferences successfully', async () => {
      validateAlertPreferences.mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockUser = {
        id: 'user123',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 'MODERATE',
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '06:00',
            overrideForCritical: true
          }
        }
      };

      updateAlertPreferences.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          alertPreferences: {
            categories: ['WEATHER', 'EARTHQUAKE'],
            minSeverity: 'MODERATE',
            quietHours: {
              enabled: true,
              start: '22:00',
              end: '06:00',
              overrideForCritical: true
            }
          }
        })
      };

      const response = await updateUserAlertPreferences(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('Alert preferences updated successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(updateAlertPreferences).toHaveBeenCalledWith('user123', expect.objectContaining({
        categories: ['WEATHER', 'EARTHQUAKE'],
        minSeverity: 'MODERATE'
      }));
    });

    it('should handle errors gracefully', async () => {
      validateAlertPreferences.mockReturnValue({
        isValid: true,
        errors: []
      });

      updateAlertPreferences.mockRejectedValue(new Error('Database error'));

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          alertPreferences: {
            categories: ['WEATHER']
          }
        })
      };

      const response = await updateUserAlertPreferences(event);
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body).message).toContain('Error updating alert preferences');
      expect(JSON.parse(response.body).error).toContain('Database error');
    });
  });

  describe('updateUserNotificationChannels', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          notificationChannels: []
        })
      };

      const response = await updateUserNotificationChannels(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if notificationChannels is missing', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123'
        })
      };

      const response = await updateUserNotificationChannels(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Notification channels are required');
    });

    it('should return 400 if notificationChannels validation fails', async () => {
      validateNotificationChannels.mockReturnValue({
        isValid: false,
        errors: ['Invalid channel type']
      });

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          notificationChannels: [
            {
              channelType: 'INVALID_TYPE',
              channelId: 'email@example.com',
              priority: 1,
              enabled: true
            }
          ]
        })
      };

      const response = await updateUserNotificationChannels(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid notification channels');
      expect(JSON.parse(response.body).errors).toContain('Invalid channel type');
    });

    it('should update notification channels successfully', async () => {
      validateNotificationChannels.mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockUser = {
        id: 'user123',
        notificationChannels: [
          {
            channelType: 'EMAIL',
            channelId: 'email@example.com',
            priority: 1,
            enabled: true
          },
          {
            channelType: 'SMS',
            channelId: '+1234567890',
            priority: 2,
            enabled: true
          }
        ]
      };

      updateNotificationChannels.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          notificationChannels: [
            {
              channelType: 'EMAIL',
              channelId: 'email@example.com',
              priority: 1,
              enabled: true
            },
            {
              channelType: 'SMS',
              channelId: '+1234567890',
              priority: 2,
              enabled: true
            }
          ]
        })
      };

      const response = await updateUserNotificationChannels(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('Notification channels updated successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(updateNotificationChannels).toHaveBeenCalledWith('user123', expect.arrayContaining([
        expect.objectContaining({
          channelType: 'EMAIL',
          channelId: 'email@example.com'
        })
      ]));
    });
  });

  describe('updateUserLocationsHandler', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          locations: []
        })
      };

      const response = await updateUserLocationsHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if locations is missing', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123'
        })
      };

      const response = await updateUserLocationsHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Locations are required');
    });

    it('should return 400 if locations validation fails', async () => {
      validateUserLocations.mockReturnValue({
        isValid: false,
        errors: ['Invalid location coordinates']
      });

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          locations: [
            {
              name: 'Home',
              type: 'HOME',
              coordinates: {
                latitude: 200, // Invalid latitude
                longitude: 50
              }
            }
          ]
        })
      };

      const response = await updateUserLocationsHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid locations');
      expect(JSON.parse(response.body).errors).toContain('Invalid location coordinates');
    });

    it('should update locations successfully', async () => {
      validateUserLocations.mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockUser = {
        id: 'user123',
        locations: [
          {
            locationId: 'loc123',
            name: 'Home',
            type: 'HOME',
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194
            },
            radius: 5
          }
        ]
      };

      updateUserLocations.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          locations: [
            {
              name: 'Home',
              type: 'HOME',
              coordinates: {
                latitude: 37.7749,
                longitude: -122.4194
              },
              radius: 5
            }
          ]
        })
      };

      const response = await updateUserLocationsHandler(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('Locations updated successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(updateUserLocations).toHaveBeenCalledWith('user123', expect.arrayContaining([
        expect.objectContaining({
          name: 'Home',
          type: 'HOME'
        })
      ]));
    });
  });

  describe('updateUserAccessibilityPreferences', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          accessibilityPreferences: {}
        })
      };

      const response = await updateUserAccessibilityPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if accessibilityPreferences is missing', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123'
        })
      };

      const response = await updateUserAccessibilityPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Accessibility preferences are required');
    });

    it('should return 400 if accessibilityPreferences validation fails', async () => {
      validateAccessibilityPreferences.mockReturnValue({
        isValid: false,
        errors: ['Invalid color scheme']
      });

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          accessibilityPreferences: {
            colorScheme: 'INVALID_SCHEME'
          }
        })
      };

      const response = await updateUserAccessibilityPreferences(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid accessibility preferences');
      expect(JSON.parse(response.body).errors).toContain('Invalid color scheme');
    });

    it('should update accessibility preferences successfully', async () => {
      validateAccessibilityPreferences.mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockUser = {
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

      updateAccessibilityPreferences.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          accessibilityPreferences: {
            preferredFormat: 'large-text',
            textSize: 'large',
            colorScheme: 'high-contrast',
            audioEnabled: true
          }
        })
      };

      const response = await updateUserAccessibilityPreferences(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('Accessibility preferences updated successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(updateAccessibilityPreferences).toHaveBeenCalledWith('user123', expect.objectContaining({
        preferredFormat: 'large-text',
        textSize: 'large'
      }));
    });
  });

  describe('subscribeUserToCategories', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          categories: ['WEATHER']
        })
      };

      const response = await subscribeUserToCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if categories is missing or empty', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: []
        })
      };

      const response = await subscribeUserToCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Categories array is required and must not be empty');
    });

    it('should return 400 if categories contains invalid values', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER', 'INVALID_CATEGORY']
        })
      };

      const response = await subscribeUserToCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid categories');
      expect(JSON.parse(response.body).invalidCategories).toContain('INVALID_CATEGORY');
    });

    it('should subscribe user to categories successfully', async () => {
      const mockUser = {
        id: 'user123',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE']
        }
      };

      subscribeToCategories.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER', 'EARTHQUAKE']
        })
      };

      const response = await subscribeUserToCategories(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('User subscribed to categories successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(subscribeToCategories).toHaveBeenCalledWith('user123', ['WEATHER', 'EARTHQUAKE']);
    });
  });

  describe('unsubscribeUserFromCategories', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        body: JSON.stringify({
          categories: ['WEATHER']
        })
      };

      const response = await unsubscribeUserFromCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 400 if categories is missing or empty', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: []
        })
      };

      const response = await unsubscribeUserFromCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Categories array is required and must not be empty');
    });

    it('should return 400 if categories contains invalid values', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER', 'INVALID_CATEGORY']
        })
      };

      const response = await unsubscribeUserFromCategories(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid categories');
      expect(JSON.parse(response.body).invalidCategories).toContain('INVALID_CATEGORY');
    });

    it('should unsubscribe user from categories successfully', async () => {
      const mockUser = {
        id: 'user123',
        alertPreferences: {
          categories: ['EARTHQUAKE']
        }
      };

      unsubscribeFromCategories.mockResolvedValue(mockUser);

      const event = {
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER']
        })
      };

      const response = await unsubscribeUserFromCategories(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('User unsubscribed from categories successfully');
      expect(JSON.parse(response.body).user).toEqual(mockUser);
      expect(unsubscribeFromCategories).toHaveBeenCalledWith('user123', ['WEATHER']);
    });
  });

  describe('getUserPreferencesHandler', () => {
    it('should return 400 if userId is missing', async () => {
      const event = {
        pathParameters: {}
      };

      const response = await getUserPreferencesHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('User ID is required');
    });

    it('should return 404 if user is not found', async () => {
      getUserPreferences.mockResolvedValue(null);

      const event = {
        pathParameters: {
          userId: 'nonexistent-user'
        }
      };

      const response = await getUserPreferencesHandler(event);
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).message).toContain('User with ID nonexistent-user not found');
    });

    it('should get user preferences successfully', async () => {
      const mockUserPreferences = {
        id: 'user123',
        username: 'testuser',
        alertPreferences: {
          categories: ['WEATHER', 'EARTHQUAKE'],
          minSeverity: 'MODERATE',
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '06:00',
            overrideForCritical: true
          }
        },
        notificationChannels: [
          {
            channelType: 'EMAIL',
            channelId: 'email@example.com',
            priority: 1,
            enabled: true
          }
        ],
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
        ],
        profile: {
          accessibilityPreferences: {
            preferredFormat: 'large-text',
            textSize: 'large',
            colorScheme: 'high-contrast',
            audioEnabled: true
          }
        }
      };

      getUserPreferences.mockResolvedValue(mockUserPreferences);

      const event = {
        pathParameters: {
          userId: 'user123'
        }
      };

      const response = await getUserPreferencesHandler(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toContain('User preferences retrieved successfully');
      expect(JSON.parse(response.body).userPreferences).toEqual(mockUserPreferences);
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
    });
  });

  describe('handler', () => {
    it('should route to getUserPreferencesHandler for GET /preferences', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      getUserPreferencesHandler.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/preferences',
        httpMethod: 'GET',
        pathParameters: {
          userId: 'user123'
        }
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(getUserPreferencesHandler).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to updateUserAlertPreferences for PUT /alert-preferences', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      updateUserAlertPreferences.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/alert-preferences',
        httpMethod: 'PUT',
        body: JSON.stringify({
          userId: 'user123',
          alertPreferences: {}
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(updateUserAlertPreferences).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to updateUserNotificationChannels for PUT /notification-channels', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      updateUserNotificationChannels.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/notification-channels',
        httpMethod: 'PUT',
        body: JSON.stringify({
          userId: 'user123',
          notificationChannels: []
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(updateUserNotificationChannels).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to updateUserLocationsHandler for PUT /locations', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      updateUserLocationsHandler.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/locations',
        httpMethod: 'PUT',
        body: JSON.stringify({
          userId: 'user123',
          locations: []
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(updateUserLocationsHandler).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to updateUserAccessibilityPreferences for PUT /accessibility-preferences', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      updateUserAccessibilityPreferences.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/accessibility-preferences',
        httpMethod: 'PUT',
        body: JSON.stringify({
          userId: 'user123',
          accessibilityPreferences: {}
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(updateUserAccessibilityPreferences).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to subscribeUserToCategories for POST /subscribe', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      subscribeUserToCategories.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/subscribe',
        httpMethod: 'POST',
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER']
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(subscribeUserToCategories).toHaveBeenCalledWith(event, undefined);
    });

    it('should route to unsubscribeUserFromCategories for POST /unsubscribe', async () => {
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
      };

      unsubscribeUserFromCategories.mockResolvedValue(mockResponse);

      const event = {
        path: '/users/user123/unsubscribe',
        httpMethod: 'POST',
        body: JSON.stringify({
          userId: 'user123',
          categories: ['WEATHER']
        })
      };

      const response = await handler(event);
      expect(response).toEqual(mockResponse);
      expect(unsubscribeUserFromCategories).toHaveBeenCalledWith(event, undefined);
    });

    it('should return 404 for unknown paths', async () => {
      const event = {
        path: '/unknown/path',
        httpMethod: 'GET'
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).message).toContain('Not found');
    });
  });
});