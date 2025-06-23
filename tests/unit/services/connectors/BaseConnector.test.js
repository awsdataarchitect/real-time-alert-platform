/**
 * Unit tests for BaseConnector
 */

import { BaseConnector } from '../../../../src/services/connectors/BaseConnector';

describe('BaseConnector', () => {
  let connector;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = jest.fn();
    connector = new BaseConnector({
      sourceId: 'test-source',
      sourceType: 'TEST',
      maxRetries: 2,
      retryDelay: 100,
      logger: mockLogger
    });
  });
  
  describe('constructor', () => {
    test('should initialize with provided options', () => {
      expect(connector.sourceId).toBe('test-source');
      expect(connector.sourceType).toBe('TEST');
      expect(connector.maxRetries).toBe(2);
      expect(connector.retryDelay).toBe(100);
      expect(connector.logger).toBe(mockLogger);
    });
    
    test('should initialize with default options when not provided', () => {
      const defaultConnector = new BaseConnector();
      expect(defaultConnector.sourceId).toBeDefined();
      expect(defaultConnector.sourceType).toBe('UNKNOWN');
      expect(defaultConnector.maxRetries).toBe(3);
      expect(defaultConnector.retryDelay).toBe(1000);
      expect(defaultConnector.logger).toBe(console.log);
    });
  });
  
  describe('fetchWithRetry', () => {
    test('should return data on successful fetch', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ data: 'test-data' });
      
      const result = await connector.fetchWithRetry(mockFetch);
      
      expect(result).toEqual({ data: 'test-data' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockLogger).not.toHaveBeenCalled();
    });
    
    test('should retry on failure', async () => {
      const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'test-data' });
      
      const result = await connector.fetchWithRetry(mockFetch);
      
      expect(result).toEqual({ data: 'test-data' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockLogger).toHaveBeenCalledTimes(1);
    });
    
    test('should throw error after max retries', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(connector.fetchWithRetry(mockFetch)).rejects.toThrow('Failed to fetch data after 2 retries');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(mockLogger).toHaveBeenCalledTimes(3);
    });
    
    test('should not retry on certain HTTP status codes', async () => {
      const notFoundError = { status: 404, message: 'Not Found' };
      const mockFetch = jest.fn().mockRejectedValue(notFoundError);
      
      await expect(connector.fetchWithRetry(mockFetch)).rejects.toEqual(notFoundError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
      expect(mockLogger).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('normalizeData', () => {
    test('should throw error when not implemented', () => {
      expect(() => connector.normalizeData({})).toThrow('normalizeData method must be implemented by subclasses');
    });
  });
  
  describe('validateData', () => {
    test('should reject null data', () => {
      const result = connector.validateData(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Normalized data is required');
    });
    
    test('should check required fields', () => {
      const result = connector.validateData({
        eventType: 'TEST',
        // Missing severity
        headline: 'Test Alert',
        // Missing description
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: severity');
      expect(result.errors).toContain('Missing required field: description');
    });
    
    test('should validate complete data', () => {
      const result = connector.validateData({
        eventType: 'TEST',
        severity: 5,
        headline: 'Test Alert',
        description: 'This is a test alert'
      });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('processData', () => {
    test('should throw error when not implemented', () => {
      expect(connector.processData()).rejects.toThrow('processData method must be implemented by subclasses');
    });
  });
});