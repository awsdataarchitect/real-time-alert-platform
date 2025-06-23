/**
 * Lambda function to classify alerts using Amazon Bedrock
 * 
 * This function processes alerts from DynamoDB and uses Amazon Bedrock
 * to classify them, add confidence scores, and validate the classifications.
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
 * Get unclassified alerts from DynamoDB
 * @param {number} limit - Maximum number of alerts to retrieve
 * @returns {Promise<Array<Object>>} - Promise resolving to array of unclassified alerts
 */
export const getUnclassifiedAlerts = async (limit = 10) => {
  try {
    // Query alerts that don't have AI classification or have low confidence
    const params = {
      TableName: ALERTS_TABLE,
      FilterExpression: 'attribute_not_exists(aiClassification) OR aiClassification.confidenceScore < :minConfidence',
      ExpressionAttributeValues: {
        ':minConfidence': 0.7
      },
      Limit: limit
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error retrieving unclassified alerts: ${error.message}`);
    throw error;
  }
};

/**
 * Classify alert using Amazon Bedrock
 * @param {Object} alert - Alert to classify
 * @returns {Promise<Object>} - Promise resolving to classification result
 */
export const classifyAlert = async (alert) => {
  try {
    // Prepare the input for Bedrock
    const prompt = `
You are an emergency alert classification system. Analyze the following alert and classify it according to these criteria:

1. Primary Category: Choose ONE from [Natural Disaster, Weather, Health, Security, Infrastructure, Transportation, Other]
2. Specific Type: Provide a specific type within the primary category (e.g., Earthquake, Hurricane, Pandemic)
3. Severity Level: Rate from 1-10 where 10 is most severe
4. Urgency: Choose ONE from [Immediate, Expected, Future, Past, Unknown]
5. Certainty: Rate from 0.0-1.0 where 1.0 is completely certain
6. Response Type: Choose ONE from [Shelter, Evacuate, Prepare, Monitor, Avoid, None]
7. Affected Population: Estimate the potential impact scope [Individual, Family, Neighborhood, City, Region, Country, Global]

Alert Details:
- Headline: ${alert.headline || 'N/A'}
- Description: ${alert.description || 'N/A'}
- Event Type: ${alert.eventType || 'N/A'}
- Source Type: ${alert.sourceType || 'N/A'}
- Location: ${JSON.stringify(alert.location) || 'N/A'}
- Start Time: ${alert.startTime || 'N/A'}
- Parameters: ${JSON.stringify(alert.parameters) || 'N/A'}

Respond in JSON format only with these fields:
{
  "primaryCategory": "string",
  "specificType": "string",
  "severityLevel": number,
  "urgency": "string",
  "certainty": number,
  "responseType": "string",
  "affectedPopulation": "string",
  "reasoning": "string"
}
`;

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0,
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
    
    const classification = JSON.parse(jsonMatch[0]);
    
    return {
      primaryCategory: classification.primaryCategory,
      specificType: classification.specificType,
      severityLevel: classification.severityLevel,
      urgency: classification.urgency,
      certainty: classification.certainty,
      responseType: classification.responseType,
      affectedPopulation: classification.affectedPopulation,
      reasoning: classification.reasoning,
      confidenceScore: calculateConfidenceScore(classification, alert)
    };
  } catch (error) {
    console.error(`Error classifying alert with Bedrock: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate confidence score based on classification and original alert
 * @param {Object} classification - Classification from Bedrock
 * @param {Object} alert - Original alert
 * @returns {number} - Confidence score between 0 and 1
 */
export const calculateConfidenceScore = (classification, alert) => {
  let score = 0.5; // Base score
  
  // Adjust based on certainty provided by Bedrock
  score += classification.certainty * 0.3;
  
  // Adjust based on consistency with original alert data
  if (alert.eventType && classification.specificType) {
    const eventTypeMatch = alert.eventType.toLowerCase().includes(classification.specificType.toLowerCase()) || 
                          classification.specificType.toLowerCase().includes(alert.eventType.toLowerCase());
    if (eventTypeMatch) {
      score += 0.1;
    }
  }
  
  // Adjust based on severity consistency
  if (alert.severity && classification.severityLevel) {
    const severityDiff = Math.abs(alert.severity - classification.severityLevel) / 10;
    score += (1 - severityDiff) * 0.1;
  }
  
  // Cap the score between 0 and 1
  return Math.min(Math.max(score, 0), 1);
};

/**
 * Validate classification result
 * @param {Object} classification - Classification to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateClassification = (classification) => {
  const errors = [];
  
  // Check required fields
  const requiredFields = [
    'primaryCategory',
    'specificType',
    'severityLevel',
    'urgency',
    'certainty',
    'responseType',
    'affectedPopulation'
  ];
  
  requiredFields.forEach(field => {
    if (!classification[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate specific fields
  if (classification.severityLevel && (classification.severityLevel < 1 || classification.severityLevel > 10)) {
    errors.push('Severity level must be between 1 and 10');
  }
  
  if (classification.certainty && (classification.certainty < 0 || classification.certainty > 1)) {
    errors.push('Certainty must be between 0 and 1');
  }
  
  // Validate primary category
  const validCategories = [
    'Natural Disaster',
    'Weather',
    'Health',
    'Security',
    'Infrastructure',
    'Transportation',
    'Other'
  ];
  
  if (classification.primaryCategory && !validCategories.includes(classification.primaryCategory)) {
    errors.push(`Invalid primary category: ${classification.primaryCategory}`);
  }
  
  // Validate urgency
  const validUrgencies = [
    'Immediate',
    'Expected',
    'Future',
    'Past',
    'Unknown'
  ];
  
  if (classification.urgency && !validUrgencies.includes(classification.urgency)) {
    errors.push(`Invalid urgency: ${classification.urgency}`);
  }
  
  // Validate response type
  const validResponseTypes = [
    'Shelter',
    'Evacuate',
    'Prepare',
    'Monitor',
    'Avoid',
    'None'
  ];
  
  if (classification.responseType && !validResponseTypes.includes(classification.responseType)) {
    errors.push(`Invalid response type: ${classification.responseType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Update alert with classification in DynamoDB
 * @param {string} alertId - ID of the alert to update
 * @param {Object} classification - Classification data
 * @returns {Promise<Object>} - Promise resolving to update result
 */
export const updateAlertClassification = async (alertId, classification) => {
  try {
    const params = {
      TableName: ALERTS_TABLE,
      Key: { alertId },
      UpdateExpression: 'set aiClassification = :classification, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':classification': classification,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating alert classification: ${error.message}`);
    throw error;
  }
};

/**
 * Process a batch of alerts for classification
 * @param {Array<Object>} alerts - Alerts to process
 * @returns {Promise<Object>} - Promise resolving to processing results
 */
export const processAlertBatch = async (alerts) => {
  const results = {
    total: alerts.length,
    classified: 0,
    failed: 0,
    skipped: 0
  };
  
  for (const alert of alerts) {
    try {
      // Skip alerts that already have high confidence classification
      if (alert.aiClassification && alert.aiClassification.confidenceScore >= 0.7) {
        results.skipped++;
        continue;
      }
      
      // Classify the alert
      const classification = await classifyAlert(alert);
      
      // Validate the classification
      const validation = validateClassification(classification);
      if (!validation.isValid) {
        console.warn(`Invalid classification for alert ${alert.alertId}: ${validation.errors.join(', ')}`);
        results.failed++;
        continue;
      }
      
      // Update the alert with the classification
      await updateAlertClassification(alert.alertId, classification);
      results.classified++;
    } catch (error) {
      console.error(`Error processing alert ${alert.alertId}: ${error.message}`);
      results.failed++;
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
    console.log('Starting alert classification process');
    
    // Get batch size from event or use default
    const batchSize = event.batchSize || 10;
    
    // Get unclassified alerts
    const alerts = await getUnclassifiedAlerts(batchSize);
    console.log(`Retrieved ${alerts.length} unclassified alerts`);
    
    if (alerts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No alerts to classify',
          results: {
            total: 0,
            classified: 0,
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
        message: 'Alert classification completed',
        results
      })
    };
  } catch (error) {
    console.error(`Error in alert classification process: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in alert classification process',
        error: error.message
      })
    };
  }
};

export default handler;