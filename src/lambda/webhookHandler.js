/**
 * Lambda function to handle webhook requests for real-time data ingestion
 * 
 * This function processes incoming webhook data, validates it, and creates alerts
 * in the system. It also handles authentication, rate limiting, and throttling.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { WebhookConnector } = require('../services/connectors/WebhookConnector');

// Initialize AWS clients
const documentClient = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Cache for API keys to reduce Secret Manager calls
const apiKeyCache = new Map();
const API_KEY_CACHE_TTL = 300000; // 5 minutes

/**
 * Validate API key against stored keys
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} - Promise resolving to true if valid, false otherwise
 */
async function validateApiKey(apiKey) {
  if (!apiKey) return false;
  
  // Check cache first
  const cachedValue = apiKeyCache.get(apiKey);
  if (cachedValue && cachedValue.expires > Date.now()) {
    return cachedValue.isValid;
  }
  
  try {
    // Get API keys from Secrets Manager
    const secretName = process.env.API_KEYS_SECRET_NAME || 'webhook-api-keys';
    const secretData = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    const apiKeys = JSON.parse(secretData.SecretString);
    
    // Check if provided key exists and is active
    const keyData = apiKeys[apiKey];
    const isValid = keyData && keyData.active === true;
    
    // Cache the result
    apiKeyCache.set(apiKey, {
      isValid,
      expires: Date.now() + API_KEY_CACHE_TTL
    });
    
    return isValid;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}

/**
 * Create alert in DynamoDB
 * @param {Object} alertData - Normalized alert data
 * @returns {Promise<Object>} - Promise resolving to created alert
 */
async function createAlert(alertData) {
  const now = new Date().toISOString();
  
  const item = {
    id: uuidv4(),
    ...alertData,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  
  await documentClient.put({
    TableName: process.env.ALERTS_TABLE_NAME,
    Item: item
  }).promise();
  
  return item;
}

/**
 * Handler for webhook requests
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Promise resolving to API Gateway response
 */
exports.handler = async (event, context) => {
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const apiKey = event.headers['x-api-key'] || body.apiKey;
    
    // Validate API key
    const isValidKey = await validateApiKey(apiKey);
    if (!isValidKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid API key' })
      };
    }
    
    // Extract source information
    const sourceIp = event.requestContext.identity.sourceIp;
    const sourceId = body.sourceId || 'unknown';
    const sourceType = body.sourceType || 'WEBHOOK';
    
    // Create webhook connector
    const webhookConnector = new WebhookConnector({
      sourceId,
      sourceType,
      rateLimits: {
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000')
      }
    });
    
    // Process single alert or batch of alerts
    if (Array.isArray(body.alerts)) {
      // Batch processing
      const results = [];
      
      for (const alertData of body.alerts) {
        try {
          // Process webhook data
          const normalizedData = await webhookConnector.processWebhookData(alertData, {
            sourceIp,
            timestamp: new Date().toISOString(),
            signature: event.headers['x-webhook-signature']
          });
          
          // Create alert
          const alert = await createAlert(normalizedData);
          results.push(alert);
        } catch (error) {
          console.error('Error processing alert:', error);
          results.push({ error: error.message });
        }
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ results })
      };
    } else {
      // Single alert processing
      const normalizedData = await webhookConnector.processWebhookData(body, {
        sourceIp,
        timestamp: new Date().toISOString(),
        signature: event.headers['x-webhook-signature']
      });
      
      // Create alert
      const alert = await createAlert(normalizedData);
      
      return {
        statusCode: 200,
        body: JSON.stringify(alert)
      };
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Check if it's a rate limiting error
    if (error.message === 'Rate limit exceeded') {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' }),
        headers: {
          'Retry-After': '60'
        }
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};