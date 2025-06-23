/**
 * Unit tests for WebhookConnector
 */

import { WebhookConnector } from '../../../../src/services/connectors/WebhookConnector';

describe('WebhookConnector', () => {
  let connector;
  
  beforeEach(() => {
    connector = new WebhookConnector({
      sourceId: 'test-source',
      sourceType: 'TEST',
      rateLimits: {
        maxRequests: 5,
        timeWindow: 1000
      }
    });
  });
  
  test('should create a WebhookConnector instance', () => {
    expect(connector).toBeInstanceOf(WebhookConnector);
    expect(connector.sourceId).toBe('test-source');
    expect(connector.sourceType).toBe('TEST');
  });
  
  test('should normalize data correctly', () => {
    const testData = {
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert',
      location: {
        type: 'Point',
        coordinates: [10, 20]
      }
    };
    
    const normalized = connector.normalizeData(testData);
    
    expect(normalized).toEqual(expect.objectContaining({
      sourceId: 'test-source',
      sourceType: 'TEST',
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert',
      location: {
        type: 'Point',
        coordinates: [10, 20]
      }
    }));
  });
  
  test('should use custom normalizer if provided', () => {
    const customNormalizer = jest.fn().mockReturnValue({
      customField: 'custom value'
    });
    
    const customConnector = new WebhookConnector({
      normalizer: customNormalizer
    });
    
    const testData = { field: 'value' };
    const normalized = customConnector.normalizeData(testData);
    
    expect(customNormalizer).toHaveBeenCalledWith(testData);
    expect(normalized).toEqual({
      customField: 'custom value'
    });
  });
  
  test('should validate data correctly', () => {
    const validData = {
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert'
    };
    
    const invalidData = {
      eventType: 'TEST_EVENT',
      // Missing required fields
    };
    
    const validResult = connector.validateData(validData);
    const invalidResult = connector.validateData(invalidData);
    
    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors).toContain('Missing required field: severity');
    expect(invalidResult.errors).toContain('Missing required field: headline');
    expect(invalidResult.errors).toContain('Missing required field: description');
  });
  
  test('should enforce rate limits', () => {
    const sourceIp = '192.168.1.1';
    
    // First 5 requests should not be rate limited
    for (let i = 0; i < 5; i++) {
      expect(connector.isRateLimited(sourceIp)).toBe(false);
    }
    
    // 6th request should be rate limited
    expect(connector.isRateLimited(sourceIp)).toBe(true);
    
    // Different IP should not be rate limited
    expect(connector.isRateLimited('192.168.1.2')).toBe(false);
  });
  
  test('should process webhook data correctly', async () => {
    const testData = {
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert',
      location: {
        type: 'Point',
        coordinates: [10, 20]
      }
    };
    
    const metadata = {
      sourceIp: '192.168.1.1',
      timestamp: '2023-01-01T00:00:00Z'
    };
    
    const result = await connector.processWebhookData(testData, metadata);
    
    expect(result).toEqual(expect.objectContaining({
      sourceId: 'test-source',
      sourceType: 'TEST',
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert'
    }));
  });
  
  test('should throw error for invalid data', async () => {
    const invalidData = {
      // Missing required fields
    };
    
    await expect(connector.processWebhookData(invalidData)).rejects.toThrow('Invalid data');
  });
  
  test('should throw error when rate limited', async () => {
    const sourceIp = '192.168.1.1';
    const testData = {
      eventType: 'TEST_EVENT',
      severity: 'MODERATE',
      headline: 'Test Alert',
      description: 'This is a test alert'
    };
    
    // Exhaust rate limit
    for (let i = 0; i < 5; i++) {
      connector.isRateLimited(sourceIp);
    }
    
    await expect(connector.processWebhookData(testData, { sourceIp })).rejects.toThrow('Rate limit exceeded');
  });
  
  test('should throw error for processData method', async () => {
    await expect(connector.processData()).rejects.toThrow('WebhookConnector does not support processData');
  });
});