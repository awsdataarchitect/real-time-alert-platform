/**
 * Unit tests for the Pattern Detection Lambda function
 */

const AWS = require('aws-sdk');
const MockDate = require('mockdate');
const patternDetection = require('../../../src/lambda/patternDetection');

// Mock AWS services
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    scan: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  const mockSNS = {
    publish: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    SNS: jest.fn(() => mockSNS)
  };
});

describe('Pattern Detection Lambda', () => {
  let mockDynamoDBClient;
  let mockSNSClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock clients
    mockDynamoDBClient = new AWS.DynamoDB.DocumentClient();
    mockSNSClient = new AWS.SNS();
    
    // Set environment variables
    process.env.ALERTS_TABLE = 'test-alerts-table';
    process.env.PATTERN_NOTIFICATION_TOPIC = 'test-topic-arn';
    
    // Fix the date for consistent testing
    MockDate.set('2025-06-22T12:00:00Z');
  });
  
  afterEach(() => {
    // Reset the mocked date
    MockDate.reset();
    
    // Clear environment variables
    delete process.env.ALERTS_TABLE;
    delete process.env.PATTERN_NOTIFICATION_TOPIC;
  });
  
  describe('handler', () => {
    it('should return early if not enough alerts are found', async () => {
      // Mock DynamoDB to return fewer alerts than the minimum required
      mockDynamoDBClient.promise.mockResolvedValueOnce({
        Items: [
          { alertId: 'alert1', eventType: 'earthquake', createdAt: '2025-06-22T10:00:00Z' },
          { alertId: 'alert2', eventType: 'flood', createdAt: '2025-06-22T11:00:00Z' }
        ]
      });
      
      const result = await patternDetection.handler({});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Not enough alerts to detect patterns');
      expect(mockSNSClient.publish).not.toHaveBeenCalled();
    });
    
    it('should detect patterns and send notifications when enough alerts exist', async () => {
      // Create a set of alerts that will trigger pattern detection
      const mockAlerts = createMockAlerts();
      
      // Mock DynamoDB to return the alerts
      mockDynamoDBClient.promise.mockResolvedValueOnce({
        Items: mockAlerts
      });
      
      // Mock SNS publish to succeed
      mockSNSClient.promise.mockResolvedValue({});
      
      const result = await patternDetection.handler({});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Pattern detection completed successfully');
      expect(JSON.parse(result.body).patternsDetected).toBeGreaterThan(0);
      expect(mockSNSClient.publish).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Mock DynamoDB to throw an error
      mockDynamoDBClient.promise.mockRejectedValueOnce(new Error('Database error'));
      
      const result = await patternDetection.handler({});
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toBe('Error detecting patterns');
      expect(JSON.parse(result.body).error).toBe('Database error');
    });
  });
  
  describe('detectTemporalPatterns', () => {
    it('should detect increasing frequency of alerts', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'earthquake', createdAt: '2025-06-22T03:00:00Z' },
        { alertId: 'a3', eventType: 'earthquake', createdAt: '2025-06-22T04:30:00Z' },
        { alertId: 'a4', eventType: 'earthquake', createdAt: '2025-06-22T05:45:00Z' },
        { alertId: 'a5', eventType: 'earthquake', createdAt: '2025-06-22T06:30:00Z' }
      ];
      
      const patterns = patternDetection.detectTemporalPatterns(alerts);
      
      expect(patterns.length).toBe(1);
      expect(patterns[0].patternType).toBe('temporal');
      expect(patterns[0].alertType).toBe('earthquake');
      expect(patterns[0].alertCount).toBe(5);
      expect(patterns[0].relatedAlertIds).toContain('a1');
      expect(patterns[0].relatedAlertIds).toContain('a5');
    });
    
    it('should not detect patterns when frequency is not increasing', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'earthquake', createdAt: '2025-06-22T02:00:00Z' },
        { alertId: 'a3', eventType: 'earthquake', createdAt: '2025-06-22T04:00:00Z' }, // Longer interval
        { alertId: 'a4', eventType: 'earthquake', createdAt: '2025-06-22T05:00:00Z' }
      ];
      
      const patterns = patternDetection.detectTemporalPatterns(alerts);
      
      expect(patterns.length).toBe(0);
    });
  });
  
  describe('detectTypeCorrelations', () => {
    it('should detect correlations between different alert types', () => {
      const alerts = [
        // Day 1
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-20T01:00:00Z' },
        { alertId: 'a2', eventType: 'tsunami', createdAt: '2025-06-20T02:00:00Z' },
        
        // Day 2
        { alertId: 'a3', eventType: 'earthquake', createdAt: '2025-06-21T01:00:00Z' },
        { alertId: 'a4', eventType: 'tsunami', createdAt: '2025-06-21T02:00:00Z' },
        
        // Day 3
        { alertId: 'a5', eventType: 'earthquake', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a6', eventType: 'tsunami', createdAt: '2025-06-22T02:00:00Z' }
      ];
      
      const patterns = patternDetection.detectTypeCorrelations(alerts);
      
      expect(patterns.length).toBe(1);
      expect(patterns[0].patternType).toBe('correlation');
      expect(patterns[0].alertTypes).toContain('earthquake');
      expect(patterns[0].alertTypes).toContain('tsunami');
      expect(patterns[0].occurrenceCount).toBe(3);
    });
    
    it('should not detect correlations when co-occurrence is infrequent', () => {
      const alerts = [
        // Day 1
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-20T01:00:00Z' },
        { alertId: 'a2', eventType: 'tsunami', createdAt: '2025-06-20T02:00:00Z' },
        
        // Day 2
        { alertId: 'a3', eventType: 'earthquake', createdAt: '2025-06-21T01:00:00Z' },
        
        // Day 3
        { alertId: 'a4', eventType: 'flood', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a5', eventType: 'tsunami', createdAt: '2025-06-22T02:00:00Z' }
      ];
      
      const patterns = patternDetection.detectTypeCorrelations(alerts);
      
      expect(patterns.length).toBe(0);
    });
  });
  
  describe('detectEscalationPatterns', () => {
    it('should detect escalating severity of alerts', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'wildfire', severity: 1, createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'wildfire', severity: 2, createdAt: '2025-06-22T03:00:00Z' },
        { alertId: 'a3', eventType: 'wildfire', severity: 3, createdAt: '2025-06-22T05:00:00Z' },
        { alertId: 'a4', eventType: 'wildfire', severity: 4, createdAt: '2025-06-22T07:00:00Z' }
      ];
      
      const patterns = patternDetection.detectEscalationPatterns(alerts);
      
      expect(patterns.length).toBe(1);
      expect(patterns[0].patternType).toBe('escalation');
      expect(patterns[0].alertType).toBe('wildfire');
      expect(patterns[0].initialSeverity).toBe(1);
      expect(patterns[0].currentSeverity).toBe(4);
    });
    
    it('should not detect escalation when severity is not increasing', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'wildfire', severity: 3, createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'wildfire', severity: 2, createdAt: '2025-06-22T03:00:00Z' }, // Decreasing
        { alertId: 'a3', eventType: 'wildfire', severity: 4, createdAt: '2025-06-22T05:00:00Z' }
      ];
      
      const patterns = patternDetection.detectEscalationPatterns(alerts);
      
      expect(patterns.length).toBe(0);
    });
  });
  
  describe('detectCascadingEffects', () => {
    it('should detect cascading effects between related alert types', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'tsunami', createdAt: '2025-06-22T02:30:00Z' } // Within time window
      ];
      
      const patterns = patternDetection.detectCascadingEffects(alerts);
      
      expect(patterns.length).toBe(1);
      expect(patterns[0].patternType).toBe('cascading');
      expect(patterns[0].triggerType).toBe('earthquake');
      expect(patterns[0].effectType).toBe('tsunami');
      expect(patterns[0].triggerAlertId).toBe('a1');
      expect(patterns[0].effectAlertIds).toContain('a2');
    });
    
    it('should not detect cascading effects when events are outside the time window', () => {
      const alerts = [
        { alertId: 'a1', eventType: 'earthquake', createdAt: '2025-06-22T01:00:00Z' },
        { alertId: 'a2', eventType: 'tsunami', createdAt: '2025-06-22T05:00:00Z' } // Outside 2-hour window
      ];
      
      const patterns = patternDetection.detectCascadingEffects(alerts);
      
      expect(patterns.length).toBe(0);
    });
  });
  
  describe('calculatePatternConfidence', () => {
    it('should calculate confidence for temporal patterns', () => {
      const pattern = {
        patternType: 'temporal',
        alertCount: 10
      };
      
      const confidence = patternDetection.calculatePatternConfidence(pattern, []);
      
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(0.95);
    });
    
    it('should calculate confidence for correlation patterns', () => {
      const pattern = {
        patternType: 'correlation',
        occurrenceCount: 5
      };
      
      const confidence = patternDetection.calculatePatternConfidence(pattern, []);
      
      expect(confidence).toBeGreaterThan(0.6);
      expect(confidence).toBeLessThanOrEqual(0.9);
    });
    
    it('should calculate confidence for escalation patterns', () => {
      const pattern = {
        patternType: 'escalation',
        initialSeverity: 1,
        currentSeverity: 5,
        alertCount: 5
      };
      
      const confidence = patternDetection.calculatePatternConfidence(pattern, []);
      
      expect(confidence).toBeGreaterThan(0.6);
      expect(confidence).toBeLessThanOrEqual(0.95);
    });
    
    it('should calculate confidence for cascading patterns', () => {
      const pattern = {
        patternType: 'cascading',
        effectAlertIds: ['a1', 'a2', 'a3']
      };
      
      const confidence = patternDetection.calculatePatternConfidence(pattern, []);
      
      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThanOrEqual(0.95);
    });
  });
});

/**
 * Helper function to create mock alerts for testing
 */
function createMockAlerts() {
  return [
    // Earthquake followed by tsunami (cascading effect)
    {
      alertId: 'eq1',
      eventType: 'earthquake',
      severity: 4,
      createdAt: '2025-06-22T01:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749] // San Francisco
      }
    },
    {
      alertId: 'ts1',
      eventType: 'tsunami',
      severity: 3,
      createdAt: '2025-06-22T01:30:00Z',
      location: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749] // San Francisco
      }
    },
    
    // Increasing frequency of wildfires (temporal pattern)
    {
      alertId: 'wf1',
      eventType: 'wildfire',
      severity: 2,
      createdAt: '2025-06-21T10:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-119.4179, 36.7783] // California
      }
    },
    {
      alertId: 'wf2',
      eventType: 'wildfire',
      severity: 2,
      createdAt: '2025-06-21T16:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-119.5179, 36.8783] // California
      }
    },
    {
      alertId: 'wf3',
      eventType: 'wildfire',
      severity: 3,
      createdAt: '2025-06-21T20:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-119.6179, 36.9783] // California
      }
    },
    {
      alertId: 'wf4',
      eventType: 'wildfire',
      severity: 4,
      createdAt: '2025-06-21T22:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-119.7179, 37.0783] // California
      }
    },
    {
      alertId: 'wf5',
      eventType: 'wildfire',
      severity: 5,
      createdAt: '2025-06-21T23:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-119.8179, 37.1783] // California
      }
    },
    
    // Correlation between heavy rainfall and flooding
    {
      alertId: 'hr1',
      eventType: 'heavy-rainfall',
      severity: 3,
      createdAt: '2025-06-20T10:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    },
    {
      alertId: 'fl1',
      eventType: 'flood',
      severity: 3,
      createdAt: '2025-06-20T14:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    },
    {
      alertId: 'hr2',
      eventType: 'heavy-rainfall',
      severity: 4,
      createdAt: '2025-06-21T10:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    },
    {
      alertId: 'fl2',
      eventType: 'flood',
      severity: 4,
      createdAt: '2025-06-21T15:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    },
    {
      alertId: 'hr3',
      eventType: 'heavy-rainfall',
      severity: 5,
      createdAt: '2025-06-22T09:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    },
    {
      alertId: 'fl3',
      eventType: 'flood',
      severity: 5,
      createdAt: '2025-06-22T11:00:00Z',
      location: {
        type: 'Point',
        coordinates: [-95.3698, 29.7604] // Houston
      }
    }
  ];
}