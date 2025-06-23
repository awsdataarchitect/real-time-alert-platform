/**
 * Unit tests for multiChannelDelivery Lambda function
 */

import { 
  getPersonalizedAlert,
  getUserChannels,
  getAccessibilityAdaptations,
  formatAlertForChannel,
  createDeliveryStatus,
  updateDeliveryStatus,
  publishDeliveryEvent,
  sendEmailAlert,
  sendSmsAlert,
  sendPushAlert,
  sendAppAlert,
  sendWebhookAlert,
  sendAlertThroughChannel,
  deliverAlertToUser,
  processBatchDelivery,
  handler
} from '../../../src/lambda/multiChannelDelivery';

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
  
  const mockSNS = {
    publish: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  const mockSES = {
    sendEmail: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  const mockEventBridge = {
    putEvents: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    SNS: jest.fn(() => mockSNS),
    SES: jest.fn(() => mockSES),
    EventBridge: jest.fn(() => mockEventBridge)
  };
});

// Mock the database query functions
jest.mock('../../../src/services/database/userPreferenceQueries', () => ({
  getUserPreferences: jest.fn()
}));

// Mock the validation functions
jest.mock('../../../src/utils/deliveryStatusValidation', () => ({
  deliveryStatusValidation: jest.fn().mockReturnValue({ valid: true, errors: [] })
}));

// Import the mocked functions
import { getUserPreferences } from '../../../src/services/database/userPreferenceQueries';
import { deliveryStatusValidation } from '../../../src/utils/deliveryStatusValidation';

// Mock DynamoDB DocumentClient, SNS, SES, and EventBridge
const mockDynamoDBClient = new (require('aws-sdk')).DynamoDB.DocumentClient();
const mockSNS = new (require('aws-sdk')).SNS();
const mockSES = new (require('aws-sdk')).SES();
const mockEventBridge = new (require('aws-sdk')).EventBridge();

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

describe('multiChannelDelivery Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Tests will be added here
});  desc
ribe('getPersonalizedAlert', () => {
    test('should return personalized alert when it exists', async () => {
      // Mock personalized alert
      const mockPersonalizedAlert = {
        personalizedAlertId: 'alert123_user123',
        alertId: 'alert123',
        userId: 'user123',
        personalizedContent: {
          headline: 'Test Alert',
          shortMessage: 'This is a test alert'
        }
      };
      
      mockDynamoDBClient.get().promise.mockResolvedValue({ Item: mockPersonalizedAlert });
      
      const result = await getPersonalizedAlert('alert123', 'user123');
      
      expect(mockDynamoDBClient.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: {
          personalizedAlertId: 'alert123_user123'
        }
      });
      expect(result).toEqual(mockPersonalizedAlert);
    });
    
    test('should throw error when personalized alert does not exist', async () => {
      mockDynamoDBClient.get().promise.mockResolvedValue({ });
      
      await expect(getPersonalizedAlert('nonexistent', 'user123')).rejects.toThrow(
        'Personalized alert not found for alert nonexistent and user user123'
      );
    });
  });
  
  describe('getUserChannels', () => {
    test('should return sorted user channels when user exists', async () => {
      // Mock user preferences
      const mockUser = {
        id: 'user123',
        notificationChannels: [
          { channelType: 'EMAIL', channelId: 'user@example.com', priority: 3, enabled: true },
          { channelType: 'SMS', channelId: '+1234567890', priority: 2, enabled: true },
          { channelType: 'PUSH', channelId: 'device-token', priority: 1, enabled: true },
          { channelType: 'WEBHOOK', channelId: 'https://example.com/webhook', enabled: false }
        ]
      };
      
      getUserPreferences.mockResolvedValue(mockUser);
      
      const result = await getUserChannels('user123');
      
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
      expect(result).toHaveLength(3); // Only enabled channels
      expect(result[0].channelType).toBe('PUSH'); // Highest priority first
      expect(result[1].channelType).toBe('SMS');
      expect(result[2].channelType).toBe('EMAIL');
    });
    
    test('should throw error when user does not exist', async () => {
      getUserPreferences.mockResolvedValue(null);
      
      await expect(getUserChannels('nonexistent')).rejects.toThrow(
        'User with ID nonexistent not found'
      );
    });
  });
  
  describe('getAccessibilityAdaptations', () => {
    test('should return accessibility adaptations when they exist', async () => {
      // Mock accessibility adaptations
      const mockAdaptations = {
        adaptationId: 'alert123:user123',
        alertId: 'alert123',
        userId: 'user123',
        adaptations: [
          {
            type: 'text-to-speech',
            adaptedContent: {
              audioContent: 'base64-audio-content',
              format: 'mp3',
              duration: 30
            }
          },
          {
            type: 'simplified-language',
            adaptedContent: {
              simplifiedHeadline: 'Simple Alert',
              simplifiedDescription: 'This is a simple alert',
              simplifiedInstructions: 'Do this simple thing'
            }
          }
        ],
        createdAt: '2025-06-22T12:00:00Z'
      };
      
      mockDynamoDBClient.get().promise.mockResolvedValue({ Item: mockAdaptations });
      
      const result = await getAccessibilityAdaptations('alert123', 'user123');
      
      expect(mockDynamoDBClient.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: {
          adaptationId: 'alert123:user123'
        }
      });
      expect(result).toEqual(mockAdaptations);
    });
    
    test('should return null when no adaptations exist', async () => {
      mockDynamoDBClient.get().promise.mockResolvedValue({});
      
      const result = await getAccessibilityAdaptations('alert123', 'user123');
      
      expect(result).toBeNull();
    });
    
    test('should return null when an error occurs', async () => {
      mockDynamoDBClient.get().promise.mockRejectedValue(new Error('Database error'));
      
      const result = await getAccessibilityAdaptations('alert123', 'user123');
      
      expect(result).toBeNull();
    });
  });
  
  describe('formatAlertForChannel', () => {
    const mockPersonalizedAlert = {
      alertId: 'alert123',
      userId: 'user123',
      personalizedContent: {
        headline: 'Test Alert',
        shortMessage: 'This is a test alert',
        detailedMessage: 'This is a detailed test alert message',
        personalizedInstructions: 'Please take appropriate action.',
        additionalContext: 'This is a test alert for demonstration purposes.'
      }
    };
    
    test('should format alert for EMAIL channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'EMAIL');
      
      expect(result).toHaveProperty('subject', 'Test Alert');
      expect(result).toHaveProperty('htmlBody');
      expect(result.htmlBody).toContain('<h1>Test Alert</h1>');
      expect(result).toHaveProperty('textBody');
      expect(result.textBody).toContain('Test Alert');
    });
    
    test('should apply accessibility adaptations when available', () => {
      const mockAdaptations = {
        adaptations: [
          {
            type: 'text-to-speech',
            adaptedContent: {
              audioContent: 'base64-audio-content',
              format: 'mp3',
              duration: 30
            }
          },
          {
            type: 'simplified-language',
            adaptedContent: {
              simplifiedHeadline: 'Simple Alert',
              simplifiedDescription: 'This is a simple alert',
              simplifiedInstructions: 'Do this simple thing'
            }
          },
          {
            type: 'language-translation',
            adaptedContent: {
              translatedHeadline: 'Alerta de Prueba',
              translatedDescription: 'Esta es una alerta de prueba',
              translatedInstructions: 'Por favor tome acción apropiada',
              targetLanguage: 'es'
            }
          }
        ]
      };
      
      const result = formatAlertForChannel(mockPersonalizedAlert, 'EMAIL', mockAdaptations);
      
      expect(result).toHaveProperty('audioContent', 'base64-audio-content');
      expect(result).toHaveProperty('simplifiedHeadline', 'Simple Alert');
      expect(result).toHaveProperty('translatedHeadline', 'Alerta de Prueba');
      expect(result).toHaveProperty('language', 'es');
    });
    
    test('should format alert for SMS channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'SMS');
      
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('ALERT: Test Alert');
      expect(result.message.length).toBeLessThan(160); // SMS should be concise
    });
    
    test('should format alert for PUSH channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'PUSH');
      
      expect(result).toHaveProperty('title', 'Test Alert');
      expect(result).toHaveProperty('body', 'This is a test alert');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('alertId', 'alert123');
    });
    
    test('should format alert for APP channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'APP');
      
      expect(result).toHaveProperty('title', 'Test Alert');
      expect(result).toHaveProperty('body', 'This is a test alert');
      expect(result).toHaveProperty('details', 'This is a detailed test alert message');
      expect(result).toHaveProperty('instructions', 'Please take appropriate action.');
    });
    
    test('should format alert for WEBHOOK channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'WEBHOOK');
      
      expect(result).toHaveProperty('alert');
      expect(result.alert).toHaveProperty('headline', 'Test Alert');
      expect(result.alert).toHaveProperty('shortMessage', 'This is a test alert');
      expect(result.alert).toHaveProperty('alertId', 'alert123');
    });
    
    test('should return base content for unknown channel', () => {
      const result = formatAlertForChannel(mockPersonalizedAlert, 'UNKNOWN');
      
      expect(result).toHaveProperty('headline', 'Test Alert');
      expect(result).toHaveProperty('message', 'This is a test alert');
      expect(result).toHaveProperty('alertId', 'alert123');
    });
  });  descr
ibe('createDeliveryStatus', () => {
    test('should create delivery status record', async () => {
      mockDynamoDBClient.put().promise.mockResolvedValue({});
      
      const result = await createDeliveryStatus('alert123', 'user123', 'EMAIL', 'user@example.com');
      
      expect(mockDynamoDBClient.put).toHaveBeenCalled();
      expect(deliveryStatusValidation).toHaveBeenCalled();
      expect(result).toHaveProperty('deliveryId', 'mock-uuid');
      expect(result).toHaveProperty('alertId', 'alert123');
      expect(result).toHaveProperty('userId', 'user123');
      expect(result).toHaveProperty('channelType', 'EMAIL');
      expect(result).toHaveProperty('channelId', 'user@example.com');
      expect(result).toHaveProperty('status', 'PENDING');
    });
    
    test('should throw error when validation fails', async () => {
      deliveryStatusValidation.mockReturnValueOnce({ valid: false, errors: ['Invalid status'] });
      
      await expect(createDeliveryStatus('alert123', 'user123', 'EMAIL', 'user@example.com')).rejects.toThrow(
        'Invalid delivery status: Invalid status'
      );
    });
  });
  
  describe('updateDeliveryStatus', () => {
    test('should update delivery status to DELIVERED and publish event', async () => {
      const mockUpdatedStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        channelType: 'EMAIL',
        channelId: 'user@example.com',
        status: 'DELIVERED',
        deliveredAt: '2025-06-22T12:00:00Z'
      };
      
      mockDynamoDBClient.update().promise.mockResolvedValue({ Attributes: mockUpdatedStatus });
      mockEventBridge.putEvents().promise.mockResolvedValue({ FailedEntryCount: 0 });
      
      // Mock the publishDeliveryEvent function
      jest.spyOn(global, 'publishDeliveryEvent').mockResolvedValue({ FailedEntryCount: 0 });
      
      const result = await updateDeliveryStatus('delivery123', 'DELIVERED');
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        TableName: expect.any(String),
        Key: {
          deliveryId: 'delivery123'
        },
        UpdateExpression: expect.stringContaining('SET #status = :status'),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'DELIVERED'
        })
      }));
      expect(global.publishDeliveryEvent).toHaveBeenCalledWith(mockUpdatedStatus);
      expect(result).toEqual(mockUpdatedStatus);
    });
    
    test('should update delivery status to FAILED with error details', async () => {
      const mockUpdatedStatus = {
        deliveryId: 'delivery123',
        status: 'FAILED',
        failedAt: '2025-06-22T12:00:00Z',
        errorDetails: {
          message: 'Test error',
          code: 'TEST_ERROR'
        }
      };
      
      mockDynamoDBClient.update().promise.mockResolvedValue({ Attributes: mockUpdatedStatus });
      
      // Mock the publishDeliveryEvent function
      jest.spyOn(global, 'publishDeliveryEvent').mockResolvedValue(null);
      
      const result = await updateDeliveryStatus('delivery123', 'FAILED', {
        errorDetails: {
          message: 'Test error',
          code: 'TEST_ERROR'
        }
      });
      
      expect(mockDynamoDBClient.update).toHaveBeenCalled();
      expect(global.publishDeliveryEvent).not.toHaveBeenCalled(); // Should not publish for FAILED status
      expect(result).toEqual(mockUpdatedStatus);
    });
  });
  
  describe('publishDeliveryEvent', () => {
    test('should publish event to EventBridge for DELIVERED status', async () => {
      const mockDeliveryStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        channelType: 'EMAIL',
        channelId: 'user@example.com',
        status: 'DELIVERED',
        deliveredAt: '2025-06-22T12:00:00Z'
      };
      
      mockEventBridge.putEvents().promise.mockResolvedValue({ FailedEntryCount: 0 });
      
      const result = await publishDeliveryEvent(mockDeliveryStatus);
      
      expect(mockEventBridge.putEvents).toHaveBeenCalledWith(expect.objectContaining({
        Entries: expect.arrayContaining([
          expect.objectContaining({
            Source: 'custom.alertDelivery',
            DetailType: 'AlertDelivered',
            Detail: expect.stringContaining('"deliveryId":"delivery123"')
          })
        ])
      }));
      expect(result).toEqual({ FailedEntryCount: 0 });
    });
    
    test('should not publish event for non-DELIVERED status', async () => {
      const mockDeliveryStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        channelType: 'EMAIL',
        channelId: 'user@example.com',
        status: 'ACKNOWLEDGED',
        acknowledgedAt: '2025-06-22T12:05:00Z'
      };
      
      const result = await publishDeliveryEvent(mockDeliveryStatus);
      
      expect(mockEventBridge.putEvents).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
    
    test('should handle errors gracefully', async () => {
      const mockDeliveryStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        channelType: 'EMAIL',
        channelId: 'user@example.com',
        status: 'DELIVERED',
        deliveredAt: '2025-06-22T12:00:00Z'
      };
      
      mockEventBridge.putEvents().promise.mockRejectedValue(new Error('EventBridge error'));
      
      const result = await publishDeliveryEvent(mockDeliveryStatus);
      
      expect(mockEventBridge.putEvents).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
  
  describe('sendEmailAlert', () => {
    test('should send email alert successfully', async () => {
      const formattedAlert = {
        subject: 'Test Alert',
        htmlBody: '<h1>Test Alert</h1>',
        textBody: 'Test Alert'
      };
      
      mockSES.sendEmail().promise.mockResolvedValue({ MessageId: 'message123' });
      
      const result = await sendEmailAlert(formattedAlert, 'user@example.com', 'delivery123');
      
      expect(mockSES.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        Destination: {
          ToAddresses: ['user@example.com']
        },
        Message: expect.objectContaining({
          Subject: expect.objectContaining({
            Data: 'Test Alert'
          })
        })
      }));
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId', 'message123');
      expect(result).toHaveProperty('channel', 'EMAIL');
    });
    
    test('should handle email sending error', async () => {
      const formattedAlert = {
        subject: 'Test Alert',
        htmlBody: '<h1>Test Alert</h1>',
        textBody: 'Test Alert'
      };
      
      mockSES.sendEmail().promise.mockRejectedValue(new Error('Email sending failed'));
      
      const result = await sendEmailAlert(formattedAlert, 'user@example.com', 'delivery123');
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'Email sending failed');
      expect(result).toHaveProperty('channel', 'EMAIL');
    });
  });
  
  describe('sendSmsAlert', () => {
    test('should send SMS alert successfully', async () => {
      const formattedAlert = {
        message: 'ALERT: Test Alert'
      };
      
      mockSNS.publish().promise.mockResolvedValue({ MessageId: 'message123' });
      
      const result = await sendSmsAlert(formattedAlert, '+1234567890', 'delivery123');
      
      expect(mockSNS.publish).toHaveBeenCalledWith(expect.objectContaining({
        Message: 'ALERT: Test Alert',
        PhoneNumber: '+1234567890'
      }));
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId', 'message123');
      expect(result).toHaveProperty('channel', 'SMS');
    });
    
    test('should handle SMS sending error', async () => {
      const formattedAlert = {
        message: 'ALERT: Test Alert'
      };
      
      mockSNS.publish().promise.mockRejectedValue(new Error('SMS sending failed'));
      
      const result = await sendSmsAlert(formattedAlert, '+1234567890', 'delivery123');
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'SMS sending failed');
      expect(result).toHaveProperty('channel', 'SMS');
    });
  });  
describe('sendAlertThroughChannel', () => {
    const mockPersonalizedAlert = {
      alertId: 'alert123',
      userId: 'user123',
      personalizedContent: {
        headline: 'Test Alert',
        shortMessage: 'This is a test alert'
      }
    };
    
    beforeEach(() => {
      // Mock the channel-specific send functions
      jest.spyOn(global, 'createDeliveryStatus').mockResolvedValue({
        deliveryId: 'delivery123',
        status: 'PENDING'
      });
      jest.spyOn(global, 'updateDeliveryStatus').mockResolvedValue({
        deliveryId: 'delivery123',
        status: 'DELIVERED'
      });
    });
    
    test('should send alert through EMAIL channel successfully', async () => {
      const channel = {
        channelType: 'EMAIL',
        channelId: 'user@example.com'
      };
      
      jest.spyOn(global, 'sendEmailAlert').mockResolvedValue({
        success: true,
        messageId: 'message123',
        channel: 'EMAIL'
      });
      
      const result = await sendAlertThroughChannel(mockPersonalizedAlert, channel);
      
      expect(global.createDeliveryStatus).toHaveBeenCalledWith(
        'alert123', 'user123', 'EMAIL', 'user@example.com'
      );
      expect(global.sendEmailAlert).toHaveBeenCalled();
      expect(global.updateDeliveryStatus).toHaveBeenCalledWith(
        'delivery123', 'DELIVERED', expect.any(Object)
      );
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('deliveryId', 'delivery123');
    });
    
    test('should handle failed alert delivery', async () => {
      const channel = {
        channelType: 'SMS',
        channelId: '+1234567890'
      };
      
      jest.spyOn(global, 'sendSmsAlert').mockResolvedValue({
        success: false,
        error: 'SMS sending failed',
        channel: 'SMS'
      });
      
      const result = await sendAlertThroughChannel(mockPersonalizedAlert, channel);
      
      expect(global.createDeliveryStatus).toHaveBeenCalledWith(
        'alert123', 'user123', 'SMS', '+1234567890'
      );
      expect(global.sendSmsAlert).toHaveBeenCalled();
      expect(global.updateDeliveryStatus).toHaveBeenCalledWith(
        'delivery123', 'FAILED', expect.any(Object)
      );
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('deliveryId', 'delivery123');
    });
    
    test('should throw error for unsupported channel type', async () => {
      const channel = {
        channelType: 'UNSUPPORTED',
        channelId: 'test'
      };
      
      const result = await sendAlertThroughChannel(mockPersonalizedAlert, channel);
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', expect.stringContaining('Unsupported channel type'));
    });
  });
  
  describe('deliverAlertToUser', () => {
    beforeEach(() => {
      // Mock the required functions
      jest.spyOn(global, 'getPersonalizedAlert').mockResolvedValue({
        alertId: 'alert123',
        userId: 'user123',
        personalizedContent: {
          headline: 'Test Alert',
          shortMessage: 'This is a test alert'
        }
      });
      
      jest.spyOn(global, 'getUserChannels').mockResolvedValue([
        { channelType: 'PUSH', channelId: 'device-token', priority: 1 },
        { channelType: 'SMS', channelId: '+1234567890', priority: 2 },
        { channelType: 'EMAIL', channelId: 'user@example.com', priority: 3 }
      ]);
      
      jest.spyOn(global, 'sendAlertThroughChannel').mockResolvedValue({
        success: true,
        deliveryId: 'delivery123'
      });
    });
    
    test('should deliver alert to user through all channels when not time-sensitive', async () => {
      // Mock getAccessibilityAdaptations
      jest.spyOn(global, 'getAccessibilityAdaptations').mockResolvedValue({
        adaptations: [
          { type: 'text-to-speech', adaptedContent: { audioContent: 'audio-data' } }
        ]
      });
      const result = await deliverAlertToUser('alert123', 'user123', false);
      
      expect(global.getPersonalizedAlert).toHaveBeenCalledWith('alert123', 'user123');
      expect(global.getUserChannels).toHaveBeenCalledWith('user123');
      expect(global.sendAlertThroughChannel).toHaveBeenCalledTimes(3); // All channels
      expect(result).toHaveProperty('success', true);
      expect(result.successfulDeliveries).toHaveLength(3);
      expect(result.failedDeliveries).toHaveLength(0);
    });
    
    test('should deliver alert only through highest priority channel when time-sensitive', async () => {
      // Mock getAccessibilityAdaptations
      jest.spyOn(global, 'getAccessibilityAdaptations').mockResolvedValue(null);
      const result = await deliverAlertToUser('alert123', 'user123', true);
      
      expect(global.sendAlertThroughChannel).toHaveBeenCalledTimes(1); // Only highest priority
      expect(result).toHaveProperty('success', true);
      expect(result.successfulDeliveries).toHaveLength(1);
      expect(result.successfulDeliveries[0].channelType).toBe('PUSH'); // Highest priority
    });
    
    test('should deliver alert through specific channel when provided', async () => {
      // Mock getAccessibilityAdaptations
      jest.spyOn(global, 'getAccessibilityAdaptations').mockResolvedValue(null);
      const specificChannel = { channelType: 'SMS', channelId: '+1234567890' };
      
      const result = await deliverAlertToUser('alert123', 'user123', false, specificChannel);
      
      expect(global.sendAlertThroughChannel).toHaveBeenCalledTimes(1);
      expect(global.sendAlertThroughChannel).toHaveBeenCalledWith(
        expect.anything(),
        specificChannel
      );
      expect(result).toHaveProperty('success', true);
      expect(result.successfulDeliveries).toHaveLength(1);
      expect(result.successfulDeliveries[0].channelType).toBe('SMS');
    });
    
    test('should handle case when user has no channels', async () => {
      global.getUserChannels.mockResolvedValueOnce([]);
      
      const result = await deliverAlertToUser('alert123', 'user123');
      
      expect(global.sendAlertThroughChannel).not.toHaveBeenCalled();
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'No notification channels configured for user');
    });
    
    test('should stop after first successful delivery when time-sensitive', async () => {
      // First channel fails, second succeeds
      global.sendAlertThroughChannel
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, deliveryId: 'delivery123' });
      
      const result = await deliverAlertToUser('alert123', 'user123', true);
      
      expect(global.sendAlertThroughChannel).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('success', true);
      expect(result.successfulDeliveries).toHaveLength(1);
      expect(result.failedDeliveries).toHaveLength(1);
    });
  });
  
  describe('handler', () => {
    beforeEach(() => {
      jest.spyOn(global, 'deliverAlertToUser').mockResolvedValue({
        success: true,
        userId: 'user123',
        alertId: 'alert123',
        successfulDeliveries: [{ channelType: 'EMAIL' }],
        failedDeliveries: []
      });
      
      jest.spyOn(global, 'processBatchDelivery').mockResolvedValue({
        total: 2,
        successful: 2,
        failed: 0,
        details: []
      });
    });
    
    test('should handle single user delivery', async () => {
      const event = {
        alertId: 'alert123',
        userId: 'user123',
        isTimeSensitive: false
      };
      
      const result = await handler(event);
      
      expect(global.deliverAlertToUser).toHaveBeenCalledWith('alert123', 'user123', false, null);
      expect(result).toHaveProperty('statusCode', 200);
      expect(JSON.parse(result.body)).toHaveProperty('message', 'Alert delivered successfully');
    });
    
    test('should handle delivery with specific channel', async () => {
      const specificChannel = { channelType: 'SMS', channelId: '+1234567890' };
      const event = {
        alertId: 'alert123',
        userId: 'user123',
        isTimeSensitive: true,
        specificChannel
      };
      
      const result = await handler(event);
      
      expect(global.deliverAlertToUser).toHaveBeenCalledWith('alert123', 'user123', true, specificChannel);
      expect(result).toHaveProperty('statusCode', 200);
    });
    
    test('should handle batch delivery', async () => {
      const event = {
        alertId: 'alert123',
        userIds: ['user1', 'user2'],
        isTimeSensitive: true
      };
      
      const result = await handler(event);
      
      expect(global.processBatchDelivery).toHaveBeenCalledWith(['user1', 'user2'], 'alert123', true);
      expect(result).toHaveProperty('statusCode', 200);
      expect(JSON.parse(result.body)).toHaveProperty('message', 'Batch delivery processing completed');
    });
    
    test('should return error when alertId is missing', async () => {
      const event = {
        userId: 'user123'
      };
      
      const result = await handler(event);
      
      expect(result).toHaveProperty('statusCode', 400);
      expect(JSON.parse(result.body)).toHaveProperty('message', 'Alert ID is required');
    });
    
    test('should return error when both userId and userIds are missing', async () => {
      const event = {
        alertId: 'alert123'
      };
      
      const result = await handler(event);
      
      expect(result).toHaveProperty('statusCode', 400);
      expect(JSON.parse(result.body)).toHaveProperty('message', 'Either userId or userIds array is required');
    });
  });
});