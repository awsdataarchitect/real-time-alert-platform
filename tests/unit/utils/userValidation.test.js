/**
 * Unit tests for user validation utilities
 */

import { 
  validateUser, 
  isValidEmail, 
  isValidPhone, 
  validateAccessibilityPreferences,
  validateDeviceToken
} from '../../../src/utils/userValidation';

describe('User Validation', () => {
  describe('validateUser', () => {
    test('should validate a valid user', () => {
      const user = {
        username: 'testuser',
        email: 'test@example.com',
        phone: '+12345678901',
        notificationChannels: [
          {
            channelType: 'APP_NOTIFICATION',
            channelId: 'app-1',
            priority: 1,
            enabled: true
          }
        ],
        locations: [
          {
            name: 'Home',
            type: 'HOME',
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194
            }
          }
        ],
        alertPreferences: {
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '07:00',
            overrideForCritical: true
          }
        }
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject null user', () => {
      const result = validateUser(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User object is required');
    });
    
    test('should reject user without username', () => {
      const user = {
        email: 'test@example.com'
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username is required');
    });
    
    test('should reject user with short username', () => {
      const user = {
        username: 'ab',
        email: 'test@example.com'
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must be at least 3 characters long');
    });
    
    test('should reject user with invalid email', () => {
      const user = {
        username: 'testuser',
        email: 'invalid-email'
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });
    
    test('should reject user with invalid phone', () => {
      const user = {
        username: 'testuser',
        phone: 'not-a-phone'
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid phone format');
    });
    
    test('should validate notification channels', () => {
      const user = {
        username: 'testuser',
        notificationChannels: [
          {
            // Missing channelType
            channelId: 'app-1',
            priority: 1,
            enabled: true
          }
        ]
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notification channel at index 0 is missing channelType');
    });
    
    test('should validate locations', () => {
      const user = {
        username: 'testuser',
        locations: [
          {
            name: 'Home',
            type: 'HOME',
            coordinates: {
              // Missing longitude
              latitude: 37.7749
            }
          }
        ]
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location at index 0 is missing longitude');
    });
    
    test('should validate quiet hours', () => {
      const user = {
        username: 'testuser',
        alertPreferences: {
          quietHours: {
            enabled: true,
            // Missing start and end
            overrideForCritical: true
          }
        }
      };
      
      const result = validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('QuietHours is enabled but missing start or end time');
    });
  });
  
  describe('isValidEmail', () => {
    test('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('test.name@example.co.uk')).toBe(true);
      expect(isValidEmail('test+label@example.com')).toBe(true);
    });
    
    test('should reject incorrect email formats', () => {
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@example')).toBe(false);
    });
  });
  
  describe('isValidPhone', () => {
    test('should validate correct phone formats', () => {
      expect(isValidPhone('+12345678901')).toBe(true);
      expect(isValidPhone('12345678901')).toBe(true);
      expect(isValidPhone('+441234567890')).toBe(true);
    });
    
    test('should reject incorrect phone formats', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abcdefghijk')).toBe(false);
      expect(isValidPhone('+1234567890123456')).toBe(false); // Too long
    });
  });
  
  describe('validateAccessibilityPreferences', () => {
    test('should validate correct accessibility preferences', () => {
      const preferences = {
        preferredFormat: 'large-text',
        textSize: 'large',
        colorScheme: 'high-contrast',
        audioEnabled: true
      };
      
      const result = validateAccessibilityPreferences(preferences);
      expect(result.isValid).toBe(true);
    });
    
    test('should reject invalid format', () => {
      const preferences = {
        preferredFormat: 'invalid-format',
        textSize: 'large'
      };
      
      const result = validateAccessibilityPreferences(preferences);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid preferredFormat. Must be one of: standard, large-text, high-contrast, screen-reader');
    });
    
    test('should reject invalid text size', () => {
      const preferences = {
        preferredFormat: 'standard',
        textSize: 'invalid-size'
      };
      
      const result = validateAccessibilityPreferences(preferences);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid textSize. Must be one of: small, medium, large, x-large');
    });
    
    test('should reject invalid color scheme', () => {
      const preferences = {
        preferredFormat: 'standard',
        colorScheme: 'invalid-scheme'
      };
      
      const result = validateAccessibilityPreferences(preferences);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid colorScheme. Must be one of: default, high-contrast, dark, light');
    });
  });
  
  describe('validateDeviceToken', () => {
    test('should validate correct device token', () => {
      const token = {
        deviceId: 'device-123',
        platform: 'ios',
        token: 'abcdef123456'
      };
      
      const result = validateDeviceToken(token);
      expect(result.isValid).toBe(true);
    });
    
    test('should reject null token', () => {
      const result = validateDeviceToken(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Device token is required');
    });
    
    test('should reject token without deviceId', () => {
      const token = {
        platform: 'ios',
        token: 'abcdef123456'
      };
      
      const result = validateDeviceToken(token);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Device ID is required');
    });
    
    test('should reject token with invalid platform', () => {
      const token = {
        deviceId: 'device-123',
        platform: 'windows',
        token: 'abcdef123456'
      };
      
      const result = validateDeviceToken(token);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid platform. Must be one of: ios, android, web');
    });
    
    test('should reject token without token value', () => {
      const token = {
        deviceId: 'device-123',
        platform: 'ios'
      };
      
      const result = validateDeviceToken(token);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Token value is required');
    });
  });
});