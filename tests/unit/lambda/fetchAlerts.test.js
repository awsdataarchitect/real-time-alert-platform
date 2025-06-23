/**
 * Unit tests for fetchAlerts Lambda function
 */

import { handler } from '../../../src/lambda/fetchAlerts';
import { processAllConnectors } from '../../../src/services/connectors';
import { DynamoDB } from 'aws-sdk';

// Mock the connectors module
jest.mock('../../../src/services/connectors', () => ({
  processAllConnectors: jest.fn()
}));

// Mock AWS SDK
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

describe('fetchAlerts Lambda function', () => {
  let mockDynamoClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get reference to mock DynamoDB client
    mockDynamoClient = new DynamoDB.DocumentClient();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  test('should fetch and store alerts successfully', async () => {
    // Mock alerts returned from connectors
    const mockAlerts = [
      {
        alertId: 'alert-1',
        sourceId: 'test-source',
        eventType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Test Alert 1',
        description: 'Test Description 1',
        updatedAt: '2023-06-01T12:00:00Z',
        status: 'ACTIVE'
      },
      {
        alertId: 'alert-2',
        sourceId: 'test-source',
        eventType: 'WEATHER',
        severity: 6,
        headline: 'Test Alert 2',
        description: 'Test Description 2',
        updatedAt: '2023-06-01T12:00:00Z',
        status: 'ACTIVE'
      }
    ];
    
    // Mock processAllConnectors to return test alerts
    processAllConnectors.mockResolvedValue(mockAlerts);
    
    // Mock DynamoDB responses
    mockDynamoClient.promise
      // First alert doesn't exist
      .mockResolvedValueOnce({ Item: null })
      // First alert is created
      .mockResolvedValueOnce({})
      // Second alert exists
      .mockResolvedValueOnce({ 
        Item: { 
          alertId: 'alert-2',
          sourceId: 'test-source',
          eventType: 'WEATHER',
          severity: 6,
          headline: 'Test Alert 2',
          description: 'Old Description',
          updatedAt: '2023-05-01T12:00:00Z',
          status: 'ACTIVE'
        } 
      })
      // Second alert is updated
      .mockResolvedValueOnce({});
    
    // Call the handler
    const result = await handler({});
    
    // Verify processAllConnectors was called
    expect(processAllConnectors).toHaveBeenCalled();
    
    // Verify DynamoDB operations
    expect(mockDynamoClient.get).toHaveBeenCalledTimes(2);
    expect(mockDynamoClient.put).toHaveBeenCalledTimes(1);
    expect(mockDynamoClient.update).toHaveBeenCalledTimes(1);
    
    // Verify response
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.totalAlerts).toBe(2);
    expect(body.newAlerts).toBe(1);
    expect(body.updatedAlerts).toBe(1);
  });
  
  test('should handle errors from connectors', async () => {
    // Mock processAllConnectors to throw an error
    processAllConnectors.mockRejectedValue(new Error('Test error'));
    
    // Call the handler
    const result = await handler({});
    
    // Verify response
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Test error');
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
  });
  
  test('should handle DynamoDB errors', async () => {
    // Mock alerts returned from connectors
    const mockAlerts = [
      {
        alertId: 'alert-1',
        sourceId: 'test-source',
        eventType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Test Alert 1',
        description: 'Test Description 1',
        updatedAt: '2023-06-01T12:00:00Z',
        status: 'ACTIVE'
      }
    ];
    
    // Mock processAllConnectors to return test alerts
    processAllConnectors.mockResolvedValue(mockAlerts);
    
    // Mock DynamoDB to throw an error
    mockDynamoClient.promise.mockRejectedValue(new Error('DynamoDB error'));
    
    // Call the handler
    const result = await handler({});
    
    // Verify response (should still succeed overall)
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.totalAlerts).toBe(1);
    expect(body.storedAlerts).toBe(0);
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DynamoDB error'));
  });
  
  test('should use connector options from event', async () => {
    // Mock event with connector options
    const mockEvent = {
      connectorOptions: {
        usgs: { timeRange: 'day' },
        noaa: { filters: { area: 'CA' } },
        cdc: { apiKey: 'test-key' }
      }
    };
    
    // Mock processAllConnectors to return empty array
    processAllConnectors.mockResolvedValue([]);
    
    // Call the handler
    await handler(mockEvent);
    
    // Verify processAllConnectors was called with options
    expect(processAllConnectors).toHaveBeenCalledWith(mockEvent.connectorOptions);
  });
});