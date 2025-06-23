/**
 * Lambda function for situation analysis using Amazon Bedrock
 * 
 * This function analyzes active alerts to generate comprehensive situation analysis
 * using Amazon Bedrock's generative AI capabilities. It gathers context from related
 * alerts and provides insights about the current situation.
 */

import { DynamoDB } from 'aws-sdk';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';

// Initialize clients
const dynamoDB = new DynamoDB.DocumentClient();
const bedrockRuntime = new BedrockRuntime({ region: process.env.AWS_REGION });

// Table names from environment variables
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'alerts';

// Bedrock model ID
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * Get active alerts from DynamoDB
 * @param {Object} options - Query options
 * @param {string} options.region - Geographic region to filter alerts
 * @param {string} options.eventType - Event type to filter alerts
 * @param {number} options.timeWindowHours - Time window in hours for active alerts
 * @param {number} options.limit - Maximum number of alerts to retrieve
 * @returns {Promise<Array<Object>>} - Promise resolving to array of active alerts
 */
export const getActiveAlerts = async (options = {}) => {
  try {
    const {
      region,
      eventType,
      timeWindowHours = 24,
      limit = 20
    } = options;
    
    // Calculate the timestamp for the time window
    const timeWindowStart = new Date();
    timeWindowStart.setHours(timeWindowStart.getHours() - timeWindowHours);
    const timeWindowStartStr = timeWindowStart.toISOString();
    
    // Build filter expression
    let filterExpression = 'createdAt >= :timeWindowStart';
    const expressionAttributeValues = {
      ':timeWindowStart': timeWindowStartStr
    };
    
    // Add event type filter if provided
    if (eventType) {
      filterExpression += ' AND eventType = :eventType';
      expressionAttributeValues[':eventType'] = eventType;
    }
    
    // Add region filter if provided
    if (region) {
      // This is a simplified approach - in a real implementation,
      // we would use geospatial queries to filter by region
      filterExpression += ' AND contains(locationString, :region)';
      expressionAttributeValues[':region'] = region;
    }
    
    const params = {
      TableName: ALERTS_TABLE,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error retrieving active alerts: ${error.message}`);
    throw error;
  }
};

/**
 * Get related alerts for a specific alert
 * @param {Object} alert - The main alert
 * @param {number} limit - Maximum number of related alerts to retrieve
 * @returns {Promise<Array<Object>>} - Promise resolving to array of related alerts
 */
export const getRelatedAlerts = async (alert, limit = 5) => {
  try {
    // If the alert has explicit related alerts, fetch those
    if (alert.relatedAlerts && alert.relatedAlerts.length > 0) {
      const relatedAlertIds = alert.relatedAlerts.slice(0, limit);
      
      // Batch get the related alerts
      const params = {
        RequestItems: {
          [ALERTS_TABLE]: {
            Keys: relatedAlertIds.map(alertId => ({ alertId }))
          }
        }
      };
      
      const result = await dynamoDB.batchGet(params).promise();
      return result.Responses?.[ALERTS_TABLE] || [];
    }
    
    // Otherwise, find potentially related alerts based on location and event type
    const options = {
      limit,
      timeWindowHours: 48 // Look back further for related alerts
    };
    
    // If the alert has a location, use it to find related alerts
    if (alert.location) {
      // In a real implementation, we would use geospatial queries
      // For now, we'll use a simplified approach
      if (alert.geospatialData?.geohash) {
        // Find alerts with the same or neighboring geohashes
        const geohash = alert.geospatialData.geohash;
        const neighboringGeohashes = alert.geospatialData.neighboringGeohashes || [];
        
        const params = {
          TableName: ALERTS_TABLE,
          FilterExpression: '(locationHash = :geohash OR contains(:neighboringGeohashes, locationHash)) AND alertId <> :alertId',
          ExpressionAttributeValues: {
            ':geohash': geohash,
            ':neighboringGeohashes': neighboringGeohashes.join(','),
            ':alertId': alert.alertId
          },
          Limit: limit
        };
        
        const result = await dynamoDB.scan(params).promise();
        return result.Items || [];
      }
    }
    
    // If no location data or no results, fall back to event type
    if (alert.eventType) {
      options.eventType = alert.eventType;
      const sameTypeAlerts = await getActiveAlerts(options);
      return sameTypeAlerts.filter(a => a.alertId !== alert.alertId);
    }
    
    return [];
  } catch (error) {
    console.error(`Error retrieving related alerts: ${error.message}`);
    return [];
  }
};

/**
 * Gather additional context for situation analysis
 * @param {Object} alert - The main alert
 * @returns {Promise<Object>} - Promise resolving to context data
 */
export const gatherContext = async (alert) => {
  try {
    // Get related alerts
    const relatedAlerts = await getRelatedAlerts(alert);
    
    // Get historical data for similar events
    // In a real implementation, this would query a historical database
    // For now, we'll return placeholder data
    const historicalContext = {
      similarEvents: 0,
      averageSeverity: 0,
      averageDuration: 0,
      commonOutcomes: []
    };
    
    // If we have classification data, use it to find historical patterns
    if (alert.aiClassification) {
      const { primaryCategory, specificType } = alert.aiClassification;
      
      // Placeholder for historical data lookup
      // In a real implementation, this would query a database of historical events
      historicalContext.similarEvents = 5;
      historicalContext.averageSeverity = 7.2;
      historicalContext.averageDuration = 48; // hours
      historicalContext.commonOutcomes = [
        'Property damage',
        'Road closures',
        'Power outages',
        'Evacuations'
      ];
    }
    
    return {
      relatedAlerts,
      historicalContext
    };
  } catch (error) {
    console.error(`Error gathering context: ${error.message}`);
    return {
      relatedAlerts: [],
      historicalContext: {
        similarEvents: 0,
        averageSeverity: 0,
        averageDuration: 0,
        commonOutcomes: []
      }
    };
  }
};

/**
 * Generate situation analysis using Amazon Bedrock
 * @param {Object} alert - Alert to analyze
 * @param {Object} context - Additional context for analysis
 * @returns {Promise<Object>} - Promise resolving to analysis result
 */
export const generateAnalysis = async (alert, context) => {
  try {
    // Prepare the input for Bedrock
    const relatedAlertsText = context.relatedAlerts.map(a => 
      `- ${a.headline || 'Unnamed alert'}: ${a.description || 'No description'} (Severity: ${a.severity || 'Unknown'}, Type: ${a.eventType || 'Unknown'})`
    ).join('\n');
    
    const historicalContext = context.historicalContext;
    
    const prompt = `
You are an emergency situation analysis system. Analyze the following alert and provide a comprehensive situation analysis.

PRIMARY ALERT:
- Headline: ${alert.headline || 'N/A'}
- Description: ${alert.description || 'N/A'}
- Event Type: ${alert.eventType || 'N/A'}
- Severity: ${alert.severity || 'Unknown'}
- Location: ${JSON.stringify(alert.location) || 'N/A'}
- Start Time: ${alert.startTime || 'N/A'}
- Status: ${alert.status || 'Active'}

${alert.aiClassification ? `
AI CLASSIFICATION:
- Primary Category: ${alert.aiClassification.primaryCategory || 'N/A'}
- Specific Type: ${alert.aiClassification.specificType || 'N/A'}
- Severity Level: ${alert.aiClassification.severityLevel || 'N/A'}
- Urgency: ${alert.aiClassification.urgency || 'N/A'}
- Response Type: ${alert.aiClassification.responseType || 'N/A'}
- Affected Population: ${alert.aiClassification.affectedPopulation || 'N/A'}
` : ''}

${context.relatedAlerts.length > 0 ? `
RELATED ALERTS (${context.relatedAlerts.length}):
${relatedAlertsText}
` : 'NO RELATED ALERTS FOUND'}

${historicalContext.similarEvents > 0 ? `
HISTORICAL CONTEXT:
- Similar Events: ${historicalContext.similarEvents}
- Average Severity: ${historicalContext.averageSeverity}
- Average Duration: ${historicalContext.averageDuration} hours
- Common Outcomes: ${historicalContext.commonOutcomes.join(', ')}
` : 'NO HISTORICAL CONTEXT AVAILABLE'}

Based on the above information, provide a comprehensive situation analysis with the following sections:
1. Summary: A concise overview of the current situation
2. Impact Assessment: Analysis of the potential impact on people, infrastructure, and services
3. Progression Analysis: How the situation is likely to develop in the next 24-48 hours
4. Key Concerns: The most critical aspects that decision-makers should focus on
5. Information Gaps: Important missing information that would help with assessment
6. Confidence Level: Your confidence in this analysis (Low, Medium, High) with explanation

Respond in JSON format with these sections:
{
  "summary": "string",
  "impactAssessment": "string",
  "progressionAnalysis": "string",
  "keyConcerns": ["string"],
  "informationGaps": ["string"],
  "confidenceLevel": {
    "level": "string",
    "explanation": "string"
  },
  "sources": ["string"]
}
`;

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    // Parse the response
    const responseBody = JSON.parse(Buffer.from(response.body).toString());
    const content = responseBody.content[0].text;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Bedrock response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Add metadata
    analysis.generatedAt = new Date().toISOString();
    analysis.modelId = MODEL_ID;
    
    return analysis;
  } catch (error) {
    console.error(`Error generating situation analysis with Bedrock: ${error.message}`);
    throw error;
  }
};

/**
 * Validate analysis result
 * @param {Object} analysis - Analysis to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateAnalysis = (analysis) => {
  const errors = [];
  
  // Check required fields
  const requiredFields = [
    'summary',
    'impactAssessment',
    'progressionAnalysis',
    'keyConcerns',
    'informationGaps',
    'confidenceLevel'
  ];
  
  requiredFields.forEach(field => {
    if (!analysis[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate confidence level
  if (analysis.confidenceLevel) {
    const validLevels = ['Low', 'Medium', 'High'];
    if (!validLevels.includes(analysis.confidenceLevel.level)) {
      errors.push(`Invalid confidence level: ${analysis.confidenceLevel.level}`);
    }
    
    if (!analysis.confidenceLevel.explanation) {
      errors.push('Missing confidence level explanation');
    }
  }
  
  // Validate arrays
  ['keyConcerns', 'informationGaps', 'sources'].forEach(field => {
    if (analysis[field] && !Array.isArray(analysis[field])) {
      errors.push(`Field ${field} should be an array`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Update alert with situation analysis in DynamoDB
 * @param {string} alertId - ID of the alert to update
 * @param {Object} analysis - Analysis data
 * @returns {Promise<Object>} - Promise resolving to update result
 */
export const updateAlertAnalysis = async (alertId, analysis) => {
  try {
    const params = {
      TableName: ALERTS_TABLE,
      Key: { alertId },
      UpdateExpression: 'set aiInsights = :analysis, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':analysis': analysis,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating alert with situation analysis: ${error.message}`);
    throw error;
  }
};

/**
 * Process a single alert for situation analysis
 * @param {Object} alert - Alert to analyze
 * @returns {Promise<Object>} - Promise resolving to processing result
 */
export const processAlert = async (alert) => {
  try {
    // Skip alerts that already have recent analysis
    if (alert.aiInsights && alert.aiInsights.generatedAt) {
      const analysisTime = new Date(alert.aiInsights.generatedAt);
      const currentTime = new Date();
      const hoursSinceAnalysis = (currentTime - analysisTime) / (1000 * 60 * 60);
      
      // Skip if analysis is less than 4 hours old and no significant changes
      if (hoursSinceAnalysis < 4 && !alert.significantChangeSinceLastAnalysis) {
        return {
          alertId: alert.alertId,
          status: 'skipped',
          reason: 'Recent analysis exists'
        };
      }
    }
    
    // Gather context for analysis
    const context = await gatherContext(alert);
    
    // Generate analysis
    const analysis = await generateAnalysis(alert, context);
    
    // Validate analysis
    const validation = validateAnalysis(analysis);
    if (!validation.isValid) {
      console.warn(`Invalid analysis for alert ${alert.alertId}: ${validation.errors.join(', ')}`);
      return {
        alertId: alert.alertId,
        status: 'failed',
        reason: 'Validation failed',
        errors: validation.errors
      };
    }
    
    // Update alert with analysis
    await updateAlertAnalysis(alert.alertId, analysis);
    
    return {
      alertId: alert.alertId,
      status: 'processed',
      confidenceLevel: analysis.confidenceLevel.level
    };
  } catch (error) {
    console.error(`Error processing situation analysis for alert ${alert.alertId}: ${error.message}`);
    return {
      alertId: alert.alertId,
      status: 'failed',
      error: error.message
    };
  }
};

/**
 * Process a batch of alerts for situation analysis
 * @param {Array<Object>} alerts - Alerts to process
 * @returns {Promise<Object>} - Promise resolving to processing results
 */
export const processAlertBatch = async (alerts) => {
  const results = {
    total: alerts.length,
    processed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const alert of alerts) {
    try {
      const result = await processAlert(alert);
      results.details.push(result);
      
      switch (result.status) {
        case 'processed':
          results.processed++;
          break;
        case 'failed':
          results.failed++;
          break;
        case 'skipped':
          results.skipped++;
          break;
      }
    } catch (error) {
      console.error(`Unexpected error processing alert ${alert.alertId}: ${error.message}`);
      results.failed++;
      results.details.push({
        alertId: alert.alertId,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  return results;
};

/**
 * Lambda handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Promise resolving to Lambda response
 */
export const handler = async (event, context) => {
  try {
    console.log('Starting situation analysis process');
    
    // Get options from event
    const options = {
      batchSize: event.batchSize || 10,
      region: event.region,
      eventType: event.eventType,
      timeWindowHours: event.timeWindowHours || 24
    };
    
    // Get active alerts
    const alerts = await getActiveAlerts(options);
    console.log(`Retrieved ${alerts.length} active alerts for situation analysis`);
    
    if (alerts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No alerts to analyze',
          results: {
            total: 0,
            processed: 0,
            failed: 0,
            skipped: 0
          }
        })
      };
    }
    
    // Process the alerts
    const results = await processAlertBatch(alerts);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Situation analysis completed',
        results
      })
    };
  } catch (error) {
    console.error(`Error in situation analysis process: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in situation analysis process',
        error: error.message
      })
    };
  }
};

export default handler;