/**
 * Unit tests for the situationAnalysis Lambda function
 */

import { 
  getActiveAlerts,
  getRelatedAlerts,
  gatherContext,
  generateAnalysis,
  validateAnalysis,
  updateAlertAnalysis,
  processAlert,
  processAlertBatch,
  handler
} from '../../../src/lambda/situationAnalysis';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    scan: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    batchGet: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock AWS SDK v3 Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntime: jest.fn().mockImplementation(() => {
      return {
        invokeModel: jest.fn().mockImplementation(() => {
          return {
            body: Buffer.from(JSON.stringify({
              content: [
                {
                  text: `{
                    "summary": "Test summary",
                    "impactAssessment": "Test impact assessment",
                    "progressionAnalysis": "Test progression analysis",
                    "keyConcerns": ["Concern 1", "Concern 2"],
                    "informationGaps": ["Gap 1", "Gap 2"],
                    "confidenceLevel": {
                      "level": "Medium",
                      "explanation": "Test explanation"
                    },
                    "sources": ["Source 1", "Source 2"]
                  }`
                }
              ]
            }))
          };
        })
      };
    })
  };
});

// Import the mocked DynamoDB client
import { DynamoDB } from 'aws-sdk';
const mockDocumentClient = new DynamoDB.DocumentClient();

// Sample data for tests
const sampleAlert = {
  alertId: 'test-alert-1',
  headline: 'Test Alert',
  description: 'This is a test alert for unit testing',
  eventType: 'Test',
  severity: 7,
  location: {
    type: 'Point',
    coordinates: [-122.4194, 37.7749]
  },
  status: 'Active',
  createdAt: new Date().toISOString(),
  aiClassification: {
    primaryCategory: 'Weather',
    specificType: 'Storm',
    severityLevel: 7,
    urgency: 'Expected',
    responseType: 'Prepare',
    affectedPopulation: 'City',
    confidenceScore: 0.85
  }
};

const sampleRelatedAlerts = [
  {
    alertId: 'test-alert-2',
    headline: 'Related Test Alert 1',
    description: 'This is a related test alert',
    eventType: 'Test',
    severity: 6,
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    alertId: 'test-alert-3',
    headline: 'Related Test Alert 2',
    description: 'This is another related test alert',
    eventType: 'Test',
    severity: 5,
    status: 'Active',
    createdAt: new Date().toISOString()
  }
];

const sampleAnalysis = {
  summary: 'Test summary',
  impactAssessment: 'Test impact assessment',
  progressionAnalysis: 'Test progression analysis',
  keyConcerns: ['Concern 1', 'Concern 2'],
  informationGaps: ['Gap 1', 'Gap 2'],
  confidenceLevel: {
    level: 'Medium',
    explanation: 'Test explanation'
  },
  sources: ['Source 1', 'Source 2'],
  generatedAt: new Date().toISOString(),
  modelId: 'test-model'
};

describe('situationAnalysis Lambda', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('getActiveAlerts', () => {
    it('should retrieve active alerts with default options', async () => {
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: [sampleAlert]
      });
      
      const result = await getActiveAlerts();
      
      // Verify scan was called with correct parameters
      expect(mockDocumentClient.scan).toHaveBeenCalled();
      const scanParams = mockDocumentClient.scan.mock.calls[0][0];
      expect(scanParams.TableName).toBeDefined();
      expect(scanParams.FilterExpression).toContain('createdAt >= :timeWindowStart');
      
      // Verify result
      expect(result).toEqual([sampleAlert]);
    });
    
    it('should apply filters when provided', async () => {
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: [sampleAlert]
      });
      
      const options = {
        region: 'TestRegion',
        eventType: 'Test',
        timeWindowHours: 12,
        limit: 5
      };
      
      const result = await getActiveAlerts(options);
      
      // Verify scan was called with correct parameters
      expect(mockDocumentClient.scan).toHaveBeenCalled();
      const scanParams = mockDocumentClient.scan.mock.calls[0][0];
      expect(scanParams.TableName).toBeDefined();
      expect(scanParams.FilterExpression).toContain('createdAt >= :timeWindowStart');
      expect(scanParams.FilterExpression).toContain('eventType = :eventType');
      expect(scanParams.FilterExpression).toContain('contains(locationString, :region)');
      expect(scanParams.ExpressionAttributeValues[':eventType']).toBe('Test');
      expect(scanParams.ExpressionAttributeValues[':region']).toBe('TestRegion');
      expect(scanParams.Limit).toBe(5);
      
      // Verify result
      expect(result).toEqual([sampleAlert]);
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Test error'));
      
      await expect(getActiveAlerts()).rejects.toThrow('Test error');
    });
  });
  
  describe('getRelatedAlerts', () => {
    it('should retrieve related alerts from explicit relatedAlerts array', async () => {
      // Setup alert with explicit related alerts
      const alertWithRelated = {
        ...sampleAlert,
        relatedAlerts: ['test-alert-2', 'test-alert-3']
      };
      
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Responses: {
          alerts: sampleRelatedAlerts
        }
      });
      
      const result = await getRelatedAlerts(alertWithRelated);
      
      // Verify batchGet was called with correct parameters
      expect(mockDocumentClient.batchGet).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual(sampleRelatedAlerts);
    });
    
    it('should find related alerts by geohash if available', async () => {
      // Setup alert with geospatial data
      const alertWithGeohash = {
        ...sampleAlert,
        geospatialData: {
          geohash: 'abc123',
          neighboringGeohashes: ['def456', 'ghi789']
        }
      };
      
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      
      const result = await getRelatedAlerts(alertWithGeohash);
      
      // Verify scan was called with correct parameters
      expect(mockDocumentClient.scan).toHaveBeenCalled();
      const scanParams = mockDocumentClient.scan.mock.calls[0][0];
      expect(scanParams.FilterExpression).toContain('locationHash = :geohash OR contains(:neighboringGeohashes, locationHash)');
      
      // Verify result
      expect(result).toEqual(sampleRelatedAlerts);
    });
    
    it('should find related alerts by event type as fallback', async () => {
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      
      const result = await getRelatedAlerts(sampleAlert);
      
      // Verify result
      expect(result).toEqual(sampleRelatedAlerts.filter(a => a.alertId !== sampleAlert.alertId));
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Test error'));
      
      // Should return empty array on error, not throw
      const result = await getRelatedAlerts(sampleAlert);
      expect(result).toEqual([]);
    });
  });
  
  describe('gatherContext', () => {
    it('should gather context including related alerts and historical data', async () => {
      // Setup mock for getRelatedAlerts
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      
      const result = await gatherContext(sampleAlert);
      
      // Verify structure of result
      expect(result).toHaveProperty('relatedAlerts');
      expect(result).toHaveProperty('historicalContext');
      expect(result.relatedAlerts).toEqual(sampleRelatedAlerts);
      expect(result.historicalContext).toHaveProperty('similarEvents');
      expect(result.historicalContext).toHaveProperty('averageSeverity');
      expect(result.historicalContext).toHaveProperty('averageDuration');
      expect(result.historicalContext).toHaveProperty('commonOutcomes');
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await gatherContext(sampleAlert);
      
      // Should return default structure on error
      expect(result).toHaveProperty('relatedAlerts');
      expect(result).toHaveProperty('historicalContext');
      expect(result.relatedAlerts).toEqual([]);
    });
  });
  
  describe('generateAnalysis', () => {
    it('should generate analysis using Bedrock', async () => {
      const context = {
        relatedAlerts: sampleRelatedAlerts,
        historicalContext: {
          similarEvents: 5,
          averageSeverity: 7.2,
          averageDuration: 48,
          commonOutcomes: ['Outcome 1', 'Outcome 2']
        }
      };
      
      const result = await generateAnalysis(sampleAlert, context);
      
      // Verify structure of result
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('impactAssessment');
      expect(result).toHaveProperty('progressionAnalysis');
      expect(result).toHaveProperty('keyConcerns');
      expect(result).toHaveProperty('informationGaps');
      expect(result).toHaveProperty('confidenceLevel');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('modelId');
    });
    
    it('should handle errors gracefully', async () => {
      // Mock Bedrock client to throw error
      const BedrockRuntime = require('@aws-sdk/client-bedrock-runtime').BedrockRuntime;
      BedrockRuntime.mockImplementationOnce(() => {
        return {
          invokeModel: jest.fn().mockRejectedValueOnce(new Error('Bedrock error'))
        };
      });
      
      const context = {
        relatedAlerts: [],
        historicalContext: {
          similarEvents: 0,
          averageSeverity: 0,
          averageDuration: 0,
          commonOutcomes: []
        }
      };
      
      await expect(generateAnalysis(sampleAlert, context)).rejects.toThrow('Bedrock error');
    });
  });
  
  describe('validateAnalysis', () => {
    it('should validate a valid analysis', () => {
      const result = validateAnalysis(sampleAnalysis);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should detect missing required fields', () => {
      const invalidAnalysis = {
        summary: 'Test summary',
        // Missing impactAssessment
        progressionAnalysis: 'Test progression analysis',
        keyConcerns: ['Concern 1', 'Concern 2'],
        informationGaps: ['Gap 1', 'Gap 2'],
        confidenceLevel: {
          level: 'Medium',
          explanation: 'Test explanation'
        }
      };
      
      const result = validateAnalysis(invalidAnalysis);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: impactAssessment');
    });
    
    it('should validate confidence level', () => {
      const invalidAnalysis = {
        ...sampleAnalysis,
        confidenceLevel: {
          level: 'Invalid',
          explanation: 'Test explanation'
        }
      };
      
      const result = validateAnalysis(invalidAnalysis);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid confidence level: Invalid');
    });
    
    it('should validate array fields', () => {
      const invalidAnalysis = {
        ...sampleAnalysis,
        keyConcerns: 'Not an array'
      };
      
      const result = validateAnalysis(invalidAnalysis);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field keyConcerns should be an array');
    });
  });
  
  describe('updateAlertAnalysis', () => {
    it('should update alert with analysis in DynamoDB', async () => {
      // Setup mock response
      mockDocumentClient.promise.mockResolvedValueOnce({
        Attributes: {
          ...sampleAlert,
          aiInsights: sampleAnalysis
        }
      });
      
      const result = await updateAlertAnalysis(sampleAlert.alertId, sampleAnalysis);
      
      // Verify update was called with correct parameters
      expect(mockDocumentClient.update).toHaveBeenCalled();
      const updateParams = mockDocumentClient.update.mock.calls[0][0];
      expect(updateParams.TableName).toBeDefined();
      expect(updateParams.Key).toEqual({ alertId: sampleAlert.alertId });
      expect(updateParams.UpdateExpression).toBe('set aiInsights = :analysis, updatedAt = :updatedAt');
      expect(updateParams.ExpressionAttributeValues[':analysis']).toEqual(sampleAnalysis);
      
      // Verify result
      expect(result).toEqual({
        ...sampleAlert,
        aiInsights: sampleAnalysis
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Update error'));
      
      await expect(updateAlertAnalysis(sampleAlert.alertId, sampleAnalysis)).rejects.toThrow('Update error');
    });
  });
  
  describe('processAlert', () => {
    it('should skip alerts with recent analysis', async () => {
      const alertWithRecentAnalysis = {
        ...sampleAlert,
        aiInsights: {
          ...sampleAnalysis,
          generatedAt: new Date().toISOString() // Recent timestamp
        }
      };
      
      const result = await processAlert(alertWithRecentAnalysis);
      
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Recent analysis exists');
    });
    
    it('should process an alert successfully', async () => {
      // Setup mocks for the entire process
      // 1. gatherContext
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      
      // 2. updateAlertAnalysis
      mockDocumentClient.promise.mockResolvedValueOnce({
        Attributes: {
          ...sampleAlert,
          aiInsights: sampleAnalysis
        }
      });
      
      const result = await processAlert(sampleAlert);
      
      expect(result.status).toBe('processed');
      expect(result.confidenceLevel).toBe('Medium');
    });
    
    it('should handle validation failures', async () => {
      // Mock Bedrock to return invalid analysis
      const BedrockRuntime = require('@aws-sdk/client-bedrock-runtime').BedrockRuntime;
      BedrockRuntime.mockImplementationOnce(() => {
        return {
          invokeModel: jest.fn().mockImplementationOnce(() => {
            return {
              body: Buffer.from(JSON.stringify({
                content: [
                  {
                    text: `{
                      "summary": "Test summary",
                      "impactAssessment": "Test impact assessment",
                      "progressionAnalysis": "Test progression analysis",
                      "keyConcerns": "Not an array",
                      "informationGaps": ["Gap 1", "Gap 2"],
                      "confidenceLevel": {
                        "level": "Invalid",
                        "explanation": "Test explanation"
                      }
                    }`
                  }
                ]
              }))
            };
          })
        };
      });
      
      // Setup mock for gatherContext
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      
      const result = await processAlert(sampleAlert);
      
      expect(result.status).toBe('failed');
      expect(result.reason).toBe('Validation failed');
      expect(result.errors).toBeDefined();
    });
    
    it('should handle errors gracefully', async () => {
      // Mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Process error'));
      
      const result = await processAlert(sampleAlert);
      
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Process error');
    });
  });
  
  describe('processAlertBatch', () => {
    it('should process a batch of alerts', async () => {
      // Setup mocks for multiple alerts
      // For first alert - success
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      mockDocumentClient.promise.mockResolvedValueOnce({
        Attributes: {
          ...sampleAlert,
          aiInsights: sampleAnalysis
        }
      });
      
      // For second alert - skip
      const alertWithRecentAnalysis = {
        ...sampleAlert,
        alertId: 'test-alert-2',
        aiInsights: {
          ...sampleAnalysis,
          generatedAt: new Date().toISOString() // Recent timestamp
        }
      };
      
      // For third alert - fail
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Update error'));
      
      const alerts = [
        sampleAlert,
        alertWithRecentAnalysis,
        { ...sampleAlert, alertId: 'test-alert-3' }
      ];
      
      const result = await processAlertBatch(alerts);
      
      expect(result.total).toBe(3);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.details).toHaveLength(3);
    });
  });
  
  describe('handler', () => {
    it('should handle the Lambda event and return success response', async () => {
      // Setup mocks for handler
      // 1. getActiveAlerts
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: [sampleAlert]
      });
      
      // 2. processAlert
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: sampleRelatedAlerts
      });
      mockDocumentClient.promise.mockResolvedValueOnce({
        Attributes: {
          ...sampleAlert,
          aiInsights: sampleAnalysis
        }
      });
      
      const event = {
        batchSize: 10,
        timeWindowHours: 24
      };
      
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Situation analysis completed');
    });
    
    it('should handle case with no alerts to process', async () => {
      // Setup mock to return no alerts
      mockDocumentClient.promise.mockResolvedValueOnce({
        Items: []
      });
      
      const event = {};
      
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('No alerts to analyze');
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw error
      mockDocumentClient.promise.mockRejectedValueOnce(new Error('Handler error'));
      
      const event = {};
      
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('Handler error');
    });
  });
});