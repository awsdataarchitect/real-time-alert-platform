/**
 * Unit tests for pollDataSources Lambda function
 */

import { handler, pollDataSource } from '../../../src/lambda/pollDataSources';
import { getConnector } from '../../../src/services/connectors';

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock the connectors module
jest.mock('../../../src/services/connectors', () => ({
  getConnector: jest.fn(),
  processAllConnectors: jest.fn()
}));

describe('pollDataSources Lambda', () => {
  let mockDynamoDB;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get reference to mock DynamoDB client
    mockDynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Set default mock for Date.now
    jest.spyOn(Date, 'now').mockImplementation(() => 1625097600000); // 2021-07-01T00:00:00Z
  });
  
  describe('pollDataSource', () => {
    test('should poll data source and process new alerts', async () => {
      // Mock connector
      const mockConnector = {
        sourceId: 'test-source',
        processData: jest.fn().mockResolvedValue([
          { alertId: 'alert-1', updatedAt: '2021-07-01T00:00:00Z', status: 'ACTIVE', description: 'Test alert 1', instructions: 'Test instructions 1' },
          { alertId: 'alert-2', updatedAt: '2021-07-01T00:00:00Z', status: 'ACTIVE', description: 'Test alert 2', instructions: 'Test instructions 2' }
        ])
      };
      
      getConnector.mockReturnValue(mockConnector);
      
      // Mock DynamoDB responses
      mockDynamoDB.promise
        // First call - getCachedData
        .mockResolvedValueOnce({ Item: { sourceId: 'test-source', lastProcessedIds: ['old-alert'] } })
        // Next two calls - check if alerts exist
        .mockResolvedValueOnce({}) // alert-1 doesn't exist
        .mockResolvedValueOnce({}) // alert-2 doesn't exist
        // Last call - updateCache
        .mockResolvedValueOnce({});
      
      // Call pollDataSource
      const result = await pollDataSource('test-source', { param: 'value' });
      
      // Verify connector was called with options
      expect(getConnector).toHaveBeenCalledWith('test-source', { param: 'value' });
      expect(mockConnector.processData).toHaveBeenCalled();
      
      // Verify DynamoDB operations
      expect(mockDynamoDB.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { sourceId: 'test-source' }
      });
      
      expect(mockDynamoDB.put).toHaveBeenCalledTimes(3); // 2 alerts + 1 cache update
      
      // Verify result
      expect(result).toEqual({
        sourceType: 'test-source',
        sourceId: 'test-source',
        results: {
          total: 2,
          new: 2,
          updated: 0,
          duplicate: 0,
          failed: 0
        }
      });
    });
    
    test('should handle duplicate alerts', async () => {
      // Mock connector
      const mockConnector = {
        sourceId: 'test-source',
        processData: jest.fn().mockResolvedValue([
          { alertId: 'alert-1', updatedAt: '2021-07-01T00:00:00Z', status: 'ACTIVE', description: 'Test alert 1', instructions: 'Test instructions 1' },
          { alertId: 'cached-alert', updatedAt: '2021-07-01T00:00:00Z', status: 'ACTIVE', description: 'Cached alert', instructions: 'Cached instructions' }
        ])
      };
      
      getConnector.mockReturnValue(mockConnector);
      
      // Mock DynamoDB responses
      mockDynamoDB.promise
        // First call - getCachedData
        .mockResolvedValueOnce({ Item: { sourceId: 'test-source', lastProcessedIds: ['cached-alert'] } })
        // Next call - check if alert-1 exists
        .mockResolvedValueOnce({}) // alert-1 doesn't exist
        // Last call - updateCache
        .mockResolvedValueOnce({});
      
      // Call pollDataSource
      const result = await pollDataSource('test-source');
      
      // Verify result
      expect(result).toEqual({
        sourceType: 'test-source',
        sourceId: 'test-source',
        results: {
          total: 2,
          new: 1,
          updated: 0,
          duplicate: 1,
          failed: 0
        }
      });
    });
    
    test('should update existing alerts if they have been modified', async () => {
      // Mock connector
      const mockConnector = {
        sourceId: 'test-source',
        processData: jest.fn().mockResolvedValue([
          { alertId: 'alert-1', updatedAt: '2021-07-01T00:00:00Z', status: 'UPDATED', description: 'Updated alert', instructions: 'Updated instructions' }
        ])
      };
      
      getConnector.mockReturnValue(mockConnector);
      
      // Mock DynamoDB responses
      mockDynamoDB.promise
        // First call - getCachedData
        .mockResolvedValueOnce({ Item: { sourceId: 'test-source', lastProcessedIds: [] } })
        // Next call - check if alert exists
        .mockResolvedValueOnce({ Item: { alertId: 'alert-1', updatedAt: '2021-06-30T00:00:00Z' } })
        // Last call - updateCache
        .mockResolvedValueOnce({});
      
      // Call pollDataSource
      const result = await pollDataSource('test-source');
      
      // Verify DynamoDB update was called
      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { alertId: 'alert-1' },
        UpdateExpression: expect.stringContaining('updatedAt'),
        ExpressionAttributeNames: expect.any(Object),
        ExpressionAttributeValues: expect.any(Object)
      });
      
      // Verify result
      expect(result).toEqual({
        sourceType: 'test-source',
        sourceId: 'test-source',
        results: {
          total: 1,
          new: 0,
          updated: 1,
          duplicate: 0,
          failed: 0
        }
      });
    });
    
    test('should handle errors from connector', async () => {
      // Mock connector to throw error
      getConnector.mockImplementation(() => {
        throw new Error('Connector error');
      });
      
      // Call pollDataSource
      const result = await pollDataSource('test-source');
      
      // Verify error handling
      expect(result).toEqual({
        sourceType: 'test-source',
        error: 'Connector error'
      });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Connector error'));
    });
  });
  
  describe('handler', () => {
    test('should poll multiple data sources', async () => {
      // Mock pollDataSource results
      const mockPollResults = [
        {
          sourceType: 'usgs',
          sourceId: 'usgs-earthquake',
          results: { total: 2, new: 1, updated: 1, duplicate: 0, failed: 0 }
        },
        {
          sourceType: 'noaa',
          sourceId: 'noaa-weather',
          results: { total: 3, new: 2, updated: 0, duplicate: 1, failed: 0 }
        },
        {
          sourceType: 'cdc',
          error: 'API error'
        }
      ];
      
      // Create a spy on pollDataSource that returns mock results
      jest.spyOn({ pollDataSource }, 'pollDataSource')
        .mockResolvedValueOnce(mockPollResults[0])
        .mockResolvedValueOnce(mockPollResults[1])
        .mockResolvedValueOnce(mockPollResults[2]);
      
      // Call handler
      const event = {
        sourceTypes: ['usgs', 'noaa', 'cdc'],
        options: {
          usgs: { timeRange: 'day' },
          noaa: { filters: { area: 'CA' } }
        }
      };
      
      const result = await handler(event, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Data polling completed',
        summary: {
          total: 5,
          new: 3,
          updated: 1,
          duplicate: 1,
          failed: 0,
          errors: 1
        },
        results: mockPollResults
      });
    });
    
    test('should use default source types if not provided', async () => {
      // Mock pollDataSource to track calls
      jest.spyOn({ pollDataSource }, 'pollDataSource')
        .mockResolvedValue({
          sourceType: 'mock',
          sourceId: 'mock-source',
          results: { total: 0, new: 0, updated: 0, duplicate: 0, failed: 0 }
        });
      
      // Call handler with empty event
      const result = await handler({}, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      
      // Should have called pollDataSource for default sources
      expect(JSON.parse(result.body).results.length).toBe(3);
    });
    
    test('should handle errors in handler', async () => {
      // Mock to throw error
      jest.spyOn({ pollDataSource }, 'pollDataSource')
        .mockImplementation(() => {
          throw new Error('Unexpected error');
        });
      
      // Call handler
      const result = await handler({}, {});
      
      // Verify error response
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error in data polling process',
        error: 'Unexpected error'
      });
    });
  });
});