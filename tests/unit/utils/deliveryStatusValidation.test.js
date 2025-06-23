/**
 * Unit tests for deliveryStatusValidation utility
 */

import { deliveryStatusValidation } from '../../../src/utils/deliveryStatusValidation';

describe('deliveryStatusValidation', () => {
  test('should validate a valid delivery status object', () => {
    const validDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'PENDING',
      sentAt: '2025-06-22T12:00:00.000Z',
      createdAt: '2025-06-22T12:00:00.000Z',
      updatedAt: '2025-06-22T12:00:00.000Z',
      retryCount: 0
    };
    
    const result = deliveryStatusValidation(validDeliveryStatus);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('should validate a valid delivery status object with escalation fields', () => {
    const validDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      sentAt: '2025-06-22T12:00:00.000Z',
      deliveredAt: '2025-06-22T12:00:05.000Z',
      createdAt: '2025-06-22T12:00:00.000Z',
      updatedAt: '2025-06-22T12:00:05.000Z',
      retryCount: 0,
      escalationAttempt: 2,
      escalationStatus: 'DELIVERED',
      lastEscalationAt: '2025-06-22T12:30:00.000Z',
      previousChannels: [
        { channelType: 'PUSH', channelId: 'device-token' },
        { channelType: 'SMS', channelId: '+1234567890' }
      ]
    };
    
    const result = deliveryStatusValidation(validDeliveryStatus);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('should invalidate object with missing required fields', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      // Missing alertId
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      // Missing status
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: alertId');
    expect(result.errors).toContain('Missing required field: status');
  });
  
  test('should invalidate object with invalid status', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'INVALID_STATUS',
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid status: INVALID_STATUS');
  });
  
  test('should invalidate object with invalid channel type', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'INVALID_CHANNEL',
      channelId: 'user@example.com',
      status: 'PENDING',
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid channel type: INVALID_CHANNEL');
  });
  
  test('should invalidate object with invalid timestamp format', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'PENDING',
      sentAt: 'not-a-timestamp',
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid timestamp format for sentAt');
  });
  
  test('should invalidate object with negative retry count', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'PENDING',
      retryCount: -1,
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid retry count: -1');
  });
  
  test('should invalidate object with invalid escalation status', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      escalationStatus: 'INVALID_STATUS',
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid escalation status: INVALID_STATUS');
  });
  
  test('should invalidate object with negative escalation attempt', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      escalationAttempt: -2,
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid escalation attempt: -2');
  });
  
  test('should invalidate object with invalid previousChannels format', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      previousChannels: 'not-an-array',
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('previousChannels must be an array');
  });
  
  test('should invalidate object with invalid channel in previousChannels', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      previousChannels: [
        { channelType: 'PUSH', channelId: 'device-token' },
        { channelType: 'INVALID_CHANNEL', channelId: 'some-id' }
      ],
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid channel type in previousChannels[1]');
  });
  
  test('should invalidate object with missing channelId in previousChannels', () => {
    const invalidDeliveryStatus = {
      deliveryId: 'delivery123',
      alertId: 'alert123',
      userId: 'user123',
      channelType: 'EMAIL',
      channelId: 'user@example.com',
      status: 'DELIVERED',
      previousChannels: [
        { channelType: 'PUSH', channelId: 'device-token' },
        { channelType: 'SMS' } // Missing channelId
      ],
    };
    
    const result = deliveryStatusValidation(invalidDeliveryStatus);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Missing channelId in previousChannels[1]');
  });
});