/**
 * Unit tests for classifyAlerts Lambda function
 */

import {
  handler,
  getUnclassifiedAlerts,
  classifyAlert,
  calculateConfidenceScore,
  validateClassification,
  updateAlertClassification,
  processAlertBatch
} from '../../../src/lambda/classifyAlerts';

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    scan: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock the AWS SDK v3 Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntime: jest.fn().mockImplementation(() => ({
      invokeModel: jest.fn().mockResolvedValue({
        body: Buffer.from(JSON.stringify({
          content: [
            {
              text: `{
                "primaryCategory": "Natural Disaster",
                "specificType": "Earthquake",
                "severityLevel": 7,
                "urgency": "Immediate",
                "certainty": 0.85,
                "responseType": "Shelter",
                "affectedPopulation": "City",
                "reasoning": "This is clearly an earthquake based on the description and parameters."
              }`
            }
          ]
        }))
      })
    }))
  };
});

describe('classifyAlerts Lambda', () => {
  let mockDynamoDB;
  let mockBedrockRuntime;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get reference to mock DynamoDB client
    mockDynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
    
    // Get reference to mock Bedrock client
    mockBedrockRuntime = require('@aws-sdk/client-bedrock-runtime').BedrockRuntime();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    // Set default mock for Date.now and toISOString
    jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => '2021-07-01T00:00:00Z');
  });
  
  describe('getUnclassifiedAlerts', () => {
    test('should retrieve unclassified alerts from DynamoDB', async () => {
      // Mock DynamoDB response
      const mockAlerts = [
        { alertId: 'alert-1', headline: 'Test Alert 1' },
        { alertId: 'alert-2', headline: 'Test Alert 2' }
      ];
      
      mockDynamoDB.promise.mockResolvedValueOnce({ Items: mockAlerts });
      
      // Call getUnclassifiedAlerts
      const result = await getUnclassifiedAlerts(5);
      
      // Verify DynamoDB scan was called with correct parameters
      expect(mockDynamoDB.scan).toHaveBeenCalledWith({
        TableName: expect.any(String),
        FilterExpression: expect.stringContaining('attribute_not_exists(aiClassification)'),
        ExpressionAttributeValues: expect.any(Object),
        Limit: 5
      });
      
      // Verify result
      expect(result).toEqual(mockAlerts);
    });
    
    test('should handle errors from DynamoDB', async () => {
      // Mock DynamoDB error
      mockDynamoDB.promise.mockRejectedValueOnce(new Error('DynamoDB error'));
      
      // Call getUnclassifiedAlerts and expect it to throw
      await expect(getUnclassifiedAlerts()).rejects.toThrow('DynamoDB error');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DynamoDB error'));
    });
  });
  
  describe('classifyAlert', () => {
    test('should classify alert using Bedrock', async () => {
      // Mock alert
      const mockAlert = {
        alertId: 'alert-1',
        headline: 'Magnitude 6.2 Earthquake near Los Angeles',
        description: 'A strong earthquake has been detected near Los Angeles.',
        eventType: 'EARTHQUAKE',
        sourceType: 'SEISMIC',
        severity: 7,
        location: { type: 'Point', coordinates: [-118.2437, 34.0522] }
      };
      
      // Call classifyAlert
      const result = await classifyAlert(mockAlert);
      
      // Verify Bedrock was called with correct parameters
      expect(mockBedrockRuntime.invokeModel).toHaveBeenCalledWith({
        modelId: expect.any(String),
        contentType: 'application/json',
        accept: 'application/json',
        body: expect.stringContaining(mockAlert.headline)
      });
      
      // Verify result
      expect(result).toEqual({
        primaryCategory: 'Natural Disaster',
        specificType: 'Earthquake',
        severityLevel: 7,
        urgency: 'Immediate',
        certainty: 0.85,
        responseType: 'Shelter',
        affectedPopulation: 'City',
        reasoning: 'This is clearly an earthquake based on the description and parameters.',
        confidenceScore: expect.any(Number)
      });
      
      // Verify confidence score is between 0 and 1
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
    
    test('should handle errors from Bedrock', async () => {
      // Mock Bedrock error
      mockBedrockRuntime.invokeModel.mockRejectedValueOnce(new Error('Bedrock error'));
      
      // Mock alert
      const mockAlert = {
        alertId: 'alert-1',
        headline: 'Test Alert'
      };
      
      // Call classifyAlert and expect it to throw
      await expect(classifyAlert(mockAlert)).rejects.toThrow('Bedrock error');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Bedrock error'));
    });
  });
  
  describe('calculateConfidenceScore', () => {
    test('should calculate confidence score based on classification and alert', () => {
      // Mock classification and alert
      const classification = {
        primaryCategory: 'Natural Disaster',
        specificType: 'Earthquake',
        severityLevel: 7,
        certainty: 0.8
      };
      
      const alert = {
        eventType: 'EARTHQUAKE',
        severity: 7
      };
      
      // Call calculateConfidenceScore
      const score = calculateConfidenceScore(classification, alert);
      
      // Verify score is between 0 and 1
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      
      // Verify score is higher for matching event types
      const scoreMismatch = calculateConfidenceScore(
        { ...classification, specificType: 'Flood' },
        alert
      );
      
      expect(score).toBeGreaterThan(scoreMismatch);
    });
  });
  
  describe('validateClassification', () => {
    test('should validate valid classification', () => {
      // Mock valid classification
      const classification = {
        primaryCategory: 'Natural Disaster',
        specificType: 'Earthquake',
        severityLevel: 7,
        urgency: 'Immediate',
        certainty: 0.85,
        responseType: 'Shelter',
        affectedPopulation: 'City'
      };
      
      // Call validateClassification
      const result = validateClassification(classification);
      
      // Verify result
      expect(result).toEqual({
        isValid: true,
        errors: []
      });
    });
    
    test('should detect missing required fields', () => {
      // Mock invalid classification with missing fields
      const classification = {
        primaryCategory: 'Natural Disaster',
        specificType: 'Earthquake'
        // Missing other required fields
      };
      
      // Call validateClassification
      const result = validateClassification(classification);
      
      // Verify result
      expect(result).toEqual({
        isValid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('Missing required field')
        ])
      });
    });
    
    test('should validate field values', () => {
      // Mock invalid classification with invalid values
      const classification = {
        primaryCategory: 'Invalid Category',
        specificType: 'Earthquake',
        severityLevel: 15, // Out of range
        urgency: 'Invalid',
        certainty: 2.5, // Out of range
        responseType: 'Invalid',
        affectedPopulation: 'City'
      };
      
      // Call validateClassification
      const result = validateClassification(classification);
      
      // Verify result
      expect(result).toEqual({
        isValid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('Severity level must be between 1 and 10'),
          expect.stringContaining('Certainty must be between 0 and 1'),
          expect.stringContaining('Invalid primary category'),
          expect.stringContaining('Invalid urgency'),
          expect.stringContaining('Invalid response type')
        ])
      });
    });
  });
  
  describe('updateAlertClassification', () => {
    test('should update alert classification in DynamoDB', async () => {
      // Mock DynamoDB response
      const mockUpdatedAlert = {
        alertId: 'alert-1',
        headline: 'Test Alert',
        aiClassification: { primaryCategory: 'Natural Disaster' }
      };
      
      mockDynamoDB.promise.mockResolvedValueOnce({ Attributes: mockUpdatedAlert });
      
      // Mock classification
      const classification = {
        primaryCategory: 'Natural Disaster',
        specificType: 'Earthquake',
        confidenceScore: 0.85
      };
      
      // Call updateAlertClassification
      const result = await updateAlertClassification('alert-1', classification);
      
      // Verify DynamoDB update was called with correct parameters
      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { alertId: 'alert-1' },
        UpdateExpression: expect.stringContaining('aiClassification'),
        ExpressionAttributeValues: expect.any(Object),
        ReturnValues: 'ALL_NEW'
      });
      
      // Verify result
      expect(result).toEqual(mockUpdatedAlert);
    });
    
    test('should handle errors from DynamoDB', async () => {
      // Mock DynamoDB error
      mockDynamoDB.promise.mockRejectedValueOnce(new Error('DynamoDB error'));
      
      // Call updateAlertClassification and expect it to throw
      await expect(updateAlertClassification('alert-1', {})).rejects.toThrow('DynamoDB error');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DynamoDB error'));
    });
  });
  
  describe('processAlertBatch', () => {
    test('should process a batch of alerts', async () => {
      // Mock alerts
      const mockAlerts = [
        { alertId: 'alert-1', headline: 'Test Alert 1' },
        { alertId: 'alert-2', headline: 'Test Alert 2', aiClassification: { confidenceScore: 0.8 } }, // Should be skipped
        { alertId: 'alert-3', headline: 'Test Alert 3' }
      ];
      
      // Mock classifyAlert to return valid classifications
      jest.spyOn({ classifyAlert }, 'classifyAlert')
        .mockResolvedValueOnce({
          primaryCategory: 'Natural Disaster',
          specificType: 'Earthquake',
          severityLevel: 7,
          urgency: 'Immediate',
          certainty: 0.85,
          responseType: 'Shelter',
          affectedPopulation: 'City',
          confidenceScore: 0.9
        })
        .mockResolvedValueOnce({
          primaryCategory: 'Weather',
          specificType: 'Storm',
          severityLevel: 6,
          urgency: 'Expected',
          certainty: 0.75,
          responseType: 'Prepare',
          affectedPopulation: 'Region',
          confidenceScore: 0.8
        });
      
      // Mock updateAlertClassification
      jest.spyOn({ updateAlertClassification }, 'updateAlertClassification')
        .mockResolvedValue({});
      
      // Call processAlertBatch
      const result = await processAlertBatch(mockAlerts);
      
      // Verify result
      expect(result).toEqual({
        total: 3,
        classified: 2,
        failed: 0,
        skipped: 1
      });
    });
    
    test('should handle classification failures', async () => {
      // Mock alerts
      const mockAlerts = [
        { alertId: 'alert-1', headline: 'Test Alert 1' },
        { alertId: 'alert-2', headline: 'Test Alert 2' }
      ];
      
      // Mock classifyAlert to throw an error for the second alert
      jest.spyOn({ classifyAlert }, 'classifyAlert')
        .mockResolvedValueOnce({
          primaryCategory: 'Natural Disaster',
          specificType: 'Earthquake',
          severityLevel: 7,
          urgency: 'Immediate',
          certainty: 0.85,
          responseType: 'Shelter',
          affectedPopulation: 'City',
          confidenceScore: 0.9
        })
        .mockRejectedValueOnce(new Error('Classification error'));
      
      // Mock updateAlertClassification
      jest.spyOn({ updateAlertClassification }, 'updateAlertClassification')
        .mockResolvedValue({});
      
      // Call processAlertBatch
      const result = await processAlertBatch(mockAlerts);
      
      // Verify result
      expect(result).toEqual({
        total: 2,
        classified: 1,
        failed: 1,
        skipped: 0
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Classification error'));
    });
    
    test('should handle validation failures', async () => {
      // Mock alerts
      const mockAlerts = [
        { alertId: 'alert-1', headline: 'Test Alert 1' }
      ];
      
      // Mock classifyAlert to return invalid classification
      jest.spyOn({ classifyAlert }, 'classifyAlert')
        .mockResolvedValueOnce({
          // Missing required fields
          primaryCategory: 'Natural Disaster'
        });
      
      // Call processAlertBatch
      const result = await processAlertBatch(mockAlerts);
      
      // Verify result
      expect(result).toEqual({
        total: 1,
        classified: 0,
        failed: 1,
        skipped: 0
      });
      
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid classification'));
    });
  });
  
  describe('handler', () => {
    test('should process unclassified alerts', async () => {
      // Mock getUnclassifiedAlerts
      jest.spyOn({ getUnclassifiedAlerts }, 'getUnclassifiedAlerts')
        .mockResolvedValueOnce([
          { alertId: 'alert-1', headline: 'Test Alert 1' },
          { alertId: 'alert-2', headline: 'Test Alert 2' }
        ]);
      
      // Mock processAlertBatch
      jest.spyOn({ processAlertBatch }, 'processAlertBatch')
        .mockResolvedValueOnce({
          total: 2,
          classified: 2,
          failed: 0,
          skipped: 0
        });
      
      // Call handler
      const result = await handler({ batchSize: 5 }, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Alert classification completed',
        results: {
          total: 2,
          classified: 2,
          failed: 0,
          skipped: 0
        }
      });
      
      // Verify getUnclassifiedAlerts was called with correct batch size
      expect(getUnclassifiedAlerts).toHaveBeenCalledWith(5);
    });
    
    test('should handle case with no alerts to process', async () => {
      // Mock getUnclassifiedAlerts to return empty array
      jest.spyOn({ getUnclassifiedAlerts }, 'getUnclassifiedAlerts')
        .mockResolvedValueOnce([]);
      
      // Call handler
      const result = await handler({}, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'No alerts to classify',
        results: {
          total: 0,
          classified: 0,
          failed: 0,
          skipped: 0
        }
      });
    });
    
    test('should handle errors in handler', async () => {
      // Mock getUnclassifiedAlerts to throw error
      jest.spyOn({ getUnclassifiedAlerts }, 'getUnclassifiedAlerts')
        .mockRejectedValueOnce(new Error('Unexpected error'));
      
      // Call handler
      const result = await handler({}, {});
      
      // Verify error response
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error in alert classification process',
        error: 'Unexpected error'
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
    });
  });
});