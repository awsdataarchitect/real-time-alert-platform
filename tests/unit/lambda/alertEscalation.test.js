/**
 * Unit tests for alertEscalation Lambda function
 */

import { 
  checkDeliveryStatus,
  getEscalationConfig,
  checkAccessibilityNeeds,
  requestAccessibilityAdaptations,
  selectAlternativeChannel,
  logEscalationFailure,
  updateEscalationStatus,
  incrementAttempt,
  completeEscalation,
  handler
} from '../../../src/lambda/alertEscalation';

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
  
  const mockLambda = {
    invoke: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    Lambda: jest.fn(() => mockLambda)
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

// Mock DynamoDB DocumentClient and Lambda
const mockDynamoDBClient = new (require('aws-sdk')).DynamoDB.DocumentClient();
const mockLambda = new (require('aws-sdk')).Lambda();

describe('alertEscalation Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('checkDeliveryStatus', () => {
    test('should return delivery status with acknowledged=true when status is ACKNOWLEDGED', async () => {
      // Mock delivery status
      const mockDeliveryStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        status: 'ACKNOWLEDGED',
        deliveredAt: '2025-06-22T12:00:00.000Z',
        acknowledgedAt: '2025-06-22T12:05:00.000Z'
      };
      
      mockDynamoDBClient.get().promise.mockResolvedValue({ Item: mockDeliveryStatus });
      
      const result = await checkDeliveryStatus('delivery123', 'alert123', 'user123');
      
      expect(mockDynamoDBClient.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: {
          deliveryId: 'delivery123'
        }
      });
      expect(result).toHaveProperty('acknowledged', true);
      expect(result).toHaveProperty('deliveryStatus', mockDeliveryStatus);
    });
    
    test('should return delivery status with acknowledged=false when status is DELIVERED', async () => {
      // Mock delivery status
      const mockDeliveryStatus = {
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123',
        status: 'DELIVERED',
        deliveredAt: '2025-06-22T12:00:00.000Z'
      };
      
      mockDynamoDBClient.get().promise.mockResolvedValue({ Item: mockDeliveryStatus });
      
      const result = await checkDeliveryStatus('delivery123', 'alert123', 'user123');
      
      expect(result).toHaveProperty('acknowledged', false);
      expect(result).toHaveProperty('currentAttempt', 0);
      expect(result).toHaveProperty('previousChannels', []);
    });
    
    test('should throw error when delivery status not found', async () => {
      mockDynamoDBClient.get().promise.mockResolvedValue({});
      
      await expect(checkDeliveryStatus('nonexistent', 'alert123', 'user123')).rejects.toThrow(
        'Delivery status not found for deliveryId: nonexistent'
      );
    });
  });
  
    describe('checkAccessibilityNeeds', () => {
    test('should return true when user has accessibility preferences', async () => {
      // Mock user preferences with accessibility preferences
      const mockUserPreferences = {
        id: 'user123',
        profile: {
          name: 'Test User',
          accessibilityPreferences: {
            audioEnabled: true,
            preferredFormat: 'bullet-points',
            language: 'es'
          }
        }
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const result = await checkAccessibilityNeeds('user123', 'alert123');
      
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
      expect(result).toBe(true);
    });
    
    test('should return false when user has no accessibility preferences', async () => {
      // Mock user preferences without accessibility preferences
      const mockUserPreferences = {
        id: 'user123',
        profile: {
          name: 'Test User'
          // No accessibilityPreferences
        }
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const result = await checkAccessibilityNeeds('user123', 'alert123');
      
      expect(result).toBe(false);
    });
    
    test('should return false when user not found', async () => {
      getUserPreferences.mockResolvedValue(null);
      
      const result = await checkAccessibilityNeeds('nonexistent', 'alert123');
      
      expect(result).toBe(false);
    });
    
    test('should return false when error occurs', async () => {
      getUserPreferences.mockRejectedValue(new Error('Database error'));
      
      const result = await checkAccessibilityNeeds('user123', 'alert123');
      
      expect(result).toBe(false);
    });
  });
  
  describe('requestAccessibilityAdaptations', () => {
    test('should return existing adaptations when they already exist', async () => {
      // Mock existing adaptations
      mockDynamoDBClient.get().promise.mockResolvedValue({
        Item: {
          adaptationId: 'alert123:user123',
          alertId: 'alert123',
          userId: 'user123'
        }
      });
      
      const result = await requestAccessibilityAdaptations('user123', 'alert123');
      
      expect(mockDynamoDBClient.get).toHaveBeenCalledWith(expect.objectContaining({
        TableName: expect.any(String),
        Key: {
          adaptationId: 'alert123:user123'
        }
      }));
      expect(mockLambda.invoke).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.body.message).toContain('already exist');
    });
    
    test('should invoke accessibility adaptations Lambda when adaptations do not exist', async () => {
      // Mock no existing adaptations
      mockDynamoDBClient.get().promise.mockResolvedValue({});
      
      // Mock Lambda invoke
      mockLambda.invoke().promise.mockResolvedValue({});
      
      const result = await requestAccessibilityAdaptations('user123', 'alert123');
      
      expect(mockLambda.invoke).toHaveBeenCalledWith(expect.objectContaining({
        FunctionName: expect.any(String),
        InvocationType: 'Event',
        Payload: expect.stringContaining('"alertId":"alert123"')
      }));
      expect(result.statusCode).toBe(202);
      expect(result.body.message).toContain('requested');
    });
    
    test('should handle errors gracefully', async () => {
      mockDynamoDBClient.get().promise.mockRejectedValue(new Error('Database error'));
      
      const result = await requestAccessibilityAdaptations('user123', 'alert123');
      
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toContain('Database error');
    });
  });
  
  describe('getEscalationConfig', () => {
    test('should return user-specific escalation config when available', async () => {
      // Mock user preferences with custom escalation config
      const mockUserPreferences = {
        id: 'user123',
        escalationConfig: {
          maxAttempts: 5,
          waitTimes: [60, 300, 600],
          channelPriority: ['SMS', 'EMAIL', 'PUSH']
        }
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const result = await getEscalationConfig('user123', 'alert123', 'delivery123', 1);
      
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
      expect(result).toHaveProperty('escalationConfig', mockUserPreferences.escalationConfig);
      expect(result).toHaveProperty('shouldEscalate', true);
      expect(result).toHaveProperty('waitTime', 300); // Second wait time for attempt 1
    });
    
    test('should return default escalation config when user has none', async () => {
      // Mock user preferences without escalation config
      const mockUserPreferences = {
        id: 'user123'
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const result = await getEscalationConfig('user123', 'alert123', 'delivery123', 0);
      
      expect(result).toHaveProperty('escalationConfig');
      expect(result.escalationConfig).toHaveProperty('maxAttempts', 3);
      expect(result).toHaveProperty('shouldEscalate', true);
      expect(result).toHaveProperty('waitTime', 300); // First wait time
    });
    
    test('should set shouldEscalate=false when max attempts reached', async () => {
      getUserPreferences.mockResolvedValue({
        id: 'user123',
        escalationConfig: {
          maxAttempts: 3,
          waitTimes: [60, 300, 600],
          channelPriority: ['PUSH', 'SMS', 'EMAIL']
        }
      });
      
      const result = await getEscalationConfig('user123', 'alert123', 'delivery123', 3);
      
      expect(result).toHaveProperty('shouldEscalate', false);
    });
  });
  
  describe('selectAlternativeChannel', () => {
    const mockEscalationConfig = {
      maxAttempts: 3,
      waitTimes: [60, 300, 600],
      channelPriority: ['PUSH', 'SMS', 'EMAIL', 'APP', 'WEBHOOK']
    };
    
    test('should select highest priority unused channel', async () => {
      // Mock user preferences with multiple channels
      const mockUserPreferences = {
        id: 'user123',
        notificationChannels: [
          { channelType: 'EMAIL', channelId: 'user@example.com', enabled: true },
          { channelType: 'SMS', channelId: '+1234567890', enabled: true },
          { channelType: 'PUSH', channelId: 'device-token', enabled: true }
        ]
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      // Previous channels include PUSH, so SMS should be selected next
      const previousChannels = [
        { channelType: 'PUSH', channelId: 'device-token' }
      ];
      
      const result = await selectAlternativeChannel(
        'user123', 'alert123', 'delivery123', 1, mockEscalationConfig, previousChannels
      );
      
      expect(getUserPreferences).toHaveBeenCalledWith('user123');
      expect(result).toHaveProperty('channelAvailable', true);
      expect(result).toHaveProperty('selectedChannel');
      expect(result.selectedChannel).toHaveProperty('channelType', 'SMS');
    });
    
    test('should return channelAvailable=false when no channels are enabled', async () => {
      // Mock user preferences with no enabled channels
      const mockUserPreferences = {
        id: 'user123',
        notificationChannels: [
          { channelType: 'EMAIL', channelId: 'user@example.com', enabled: false },
          { channelType: 'SMS', channelId: '+1234567890', enabled: false }
        ]
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const result = await selectAlternativeChannel(
        'user123', 'alert123', 'delivery123', 1, mockEscalationConfig, []
      );
      
      expect(result).toHaveProperty('channelAvailable', false);
      expect(result).toHaveProperty('reason', 'No enabled channels available');
    });
    
    test('should start over with highest priority channel when all channels have been tried', async () => {
      // Mock user preferences with multiple channels
      const mockUserPreferences = {
        id: 'user123',
        notificationChannels: [
          { channelType: 'EMAIL', channelId: 'user@example.com', enabled: true },
          { channelType: 'SMS', channelId: '+1234567890', enabled: true },
          { channelType: 'PUSH', channelId: 'device-token', enabled: true }
        ]
      };
      
      getUserPreferences.mockResolvedValue(mockUserPreferences);
      
      // All channels have been tried
      const previousChannels = [
        { channelType: 'PUSH', channelId: 'device-token' },
        { channelType: 'SMS', channelId: '+1234567890' },
        { channelType: 'EMAIL', channelId: 'user@example.com' }
      ];
      
      const result = await selectAlternativeChannel(
        'user123', 'alert123', 'delivery123', 3, mockEscalationConfig, previousChannels
      );
      
      expect(result).toHaveProperty('channelAvailable', true);
      expect(result.selectedChannel).toHaveProperty('channelType', 'PUSH'); // Start over with highest priority
    });
    
    test('should throw error when user not found', async () => {
      getUserPreferences.mockResolvedValue(null);
      
      await expect(selectAlternativeChannel(
        'nonexistent', 'alert123', 'delivery123', 1, mockEscalationConfig, []
      )).rejects.toThrow('User with ID nonexistent not found');
    });
  });
  
  describe('logEscalationFailure', () => {
    test('should update delivery status with failure information', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const result = await logEscalationFailure(
        'user123', 'alert123', 'delivery123', 'No alternative channels available'
      );
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        TableName: expect.any(String),
        Key: {
          deliveryId: 'delivery123'
        },
        UpdateExpression: expect.stringContaining('SET escalationStatus = :status'),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'FAILED',
          ':reason': 'No alternative channels available'
        })
      }));
      expect(result).toHaveProperty('escalationStatus', 'FAILED');
      expect(result).toHaveProperty('reason', 'No alternative channels available');
    });
  });
  
  describe('updateEscalationStatus', () => {
    test('should update status to DELIVERED when delivery was successful', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const mockDeliveryResult = {
        statusCode: 200,
        body: JSON.stringify({
          result: {
            success: true,
            deliveryId: 'new-delivery-123'
          }
        })
      };
      
      const mockSelectedChannel = {
        channelType: 'SMS',
        channelId: '+1234567890'
      };
      
      const result = await updateEscalationStatus(
        'user123', 'alert123', 'delivery123', 1, mockSelectedChannel, mockDeliveryResult
      );
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        UpdateExpression: expect.stringContaining('SET escalationAttempt = :attempt, escalationStatus = :status'),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'DELIVERED',
          ':newDeliveryId': 'new-delivery-123'
        })
      }));
      expect(result).toHaveProperty('escalationStatus', 'DELIVERED');
      expect(result).toHaveProperty('newDeliveryId', 'new-delivery-123');
      expect(result).toHaveProperty('waitTime', 60); // Longer wait time for successful delivery
    });
    
    test('should update status to FAILED when delivery failed', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const mockDeliveryResult = {
        statusCode: 500,
        body: JSON.stringify({
          result: {
            success: false,
            error: 'Delivery failed'
          }
        })
      };
      
      const mockSelectedChannel = {
        channelType: 'EMAIL',
        channelId: 'user@example.com'
      };
      
      const result = await updateEscalationStatus(
        'user123', 'alert123', 'delivery123', 1, mockSelectedChannel, mockDeliveryResult
      );
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'FAILED'
        })
      }));
      expect(result).toHaveProperty('escalationStatus', 'FAILED');
      expect(result).toHaveProperty('waitTime', 30); // Shorter wait time for failed delivery
    });
  });
  
  describe('incrementAttempt', () => {
    test('should increment attempt counter and update previous channels', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const mockEscalationConfig = {
        maxAttempts: 3,
        waitTimes: [60, 300, 600]
      };
      
      const mockPreviousChannels = [
        { channelType: 'PUSH', channelId: 'device-token' }
      ];
      
      const mockSelectedChannel = {
        channelType: 'SMS',
        channelId: '+1234567890'
      };
      
      const result = await incrementAttempt(
        'user123', 'alert123', 'delivery123', 1, mockEscalationConfig, mockPreviousChannels, mockSelectedChannel
      );
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        UpdateExpression: expect.stringContaining('SET escalationAttempt = :attempt, previousChannels = :channels'),
        ExpressionAttributeValues: expect.objectContaining({
          ':attempt': 2,
          ':channels': expect.arrayContaining([
            mockPreviousChannels[0],
            mockSelectedChannel
          ])
        })
      }));
      expect(result).toHaveProperty('currentAttempt', 2);
      expect(result).toHaveProperty('previousChannels');
      expect(result.previousChannels).toHaveLength(2);
      expect(result).toHaveProperty('maxAttemptsReached', false);
    });
    
    test('should set maxAttemptsReached=true when max attempts reached', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const mockEscalationConfig = {
        maxAttempts: 3,
        waitTimes: [60, 300, 600]
      };
      
      const result = await incrementAttempt(
        'user123', 'alert123', 'delivery123', 2, mockEscalationConfig, [], null
      );
      
      expect(result).toHaveProperty('currentAttempt', 3);
      expect(result).toHaveProperty('maxAttemptsReached', true);
      expect(result).toHaveProperty('escalationSummary');
      expect(result.escalationSummary).toHaveProperty('totalAttempts', 3);
      expect(result.escalationSummary).toHaveProperty('completedAt');
    });
  });
  
  describe('completeEscalation', () => {
    test('should update delivery status with completion information', async () => {
      mockDynamoDBClient.update().promise.mockResolvedValue({});
      
      const mockEscalationSummary = {
        totalAttempts: 3,
        channels: [
          { channelType: 'PUSH', channelId: 'device-token' },
          { channelType: 'SMS', channelId: '+1234567890' },
          { channelType: 'EMAIL', channelId: 'user@example.com' }
        ],
        startedAt: '2025-06-22T12:00:00.000Z',
        completedAt: '2025-06-22T13:00:00.000Z'
      };
      
      const result = await completeEscalation(
        'user123', 'alert123', 'delivery123', mockEscalationSummary
      );
      
      expect(mockDynamoDBClient.update).toHaveBeenCalledWith(expect.objectContaining({
        UpdateExpression: expect.stringContaining('SET escalationStatus = :status, escalationCompletedAt = :timestamp'),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'COMPLETED',
          ':summary': mockEscalationSummary
        })
      }));
      expect(result).toHaveProperty('escalationStatus', 'COMPLETED');
      expect(result).toHaveProperty('escalationSummary', mockEscalationSummary);
    });
  });
  
  describe('handler', () => {
    test('should call checkDeliveryStatus when action is checkDeliveryStatus', async () => {
      // Mock the function
      jest.spyOn(global, 'checkDeliveryStatus').mockResolvedValue({
        acknowledged: false,
        deliveryStatus: {}
      });
      
      const event = {
        action: 'checkDeliveryStatus',
        deliveryId: 'delivery123',
        alertId: 'alert123',
        userId: 'user123'
      };
      
      await handler(event);
      
      expect(global.checkDeliveryStatus).toHaveBeenCalledWith(
        'delivery123', 'alert123', 'user123'
      );
    });
    
    test('should call getEscalationConfig when action is getEscalationConfig', async () => {
      // Mock the function
      jest.spyOn(global, 'getEscalationConfig').mockResolvedValue({
        shouldEscalate: true,
        escalationConfig: {}
      });
      
      const event = {
        action: 'getEscalationConfig',
        userId: 'user123',
        alertId: 'alert123',
        deliveryId: 'delivery123',
        currentAttempt: 1
      };
      
      await handler(event);
      
      expect(global.getEscalationConfig).toHaveBeenCalledWith(
        'user123', 'alert123', 'delivery123', 1
      );
    });
    
    test('should throw error for unknown action', async () => {
      const event = {
        action: 'unknownAction'
      };
      
      await expect(handler(event)).rejects.toThrow('Unknown action: unknownAction');
    });
  });
});