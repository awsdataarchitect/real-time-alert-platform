/**
 * Lambda function to fetch alerts from external data sources
 * 
 * This function uses the data source connectors to fetch alerts from external APIs,
 * normalize them to the platform's alert format, and store them in DynamoDB.
 */

import { DynamoDB } from 'aws-sdk';
import { processAllConnectors } from '../services/connectors';

// Initialize DynamoDB client
const dynamoDB = new DynamoDB.DocumentClient();
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'alerts';

/**
 * Store alerts in DynamoDB
 * @param {Array<Object>} alerts - Normalized alerts to store
 * @returns {Promise<Array<Object>>} - Promise resolving to stored alerts
 */
const storeAlerts = async (alerts) => {
  const storedAlerts = [];
  
  for (const alert of alerts) {
    try {
      // Check if alert already exists
      const existingAlert = await dynamoDB.get({
        TableName: ALERTS_TABLE,
        Key: { alertId: alert.alertId }
      }).promise();
      
      // If alert exists, update it
      if (existingAlert.Item) {
        await dynamoDB.update({
          TableName: ALERTS_TABLE,
          Key: { alertId: alert.alertId },
          UpdateExpression: 'set updatedAt = :updatedAt, #status = :status, description = :description, instructions = :instructions',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':updatedAt': alert.updatedAt,
            ':status': alert.status,
            ':description': alert.description,
            ':instructions': alert.instructions
          }
        }).promise();
        
        storedAlerts.push({ ...existingAlert.Item, ...alert, updated: true });
      } else {
        // If alert doesn't exist, create it
        await dynamoDB.put({
          TableName: ALERTS_TABLE,
          Item: alert
        }).promise();
        
        storedAlerts.push({ ...alert, created: true });
      }
    } catch (error) {
      console.error(`Error storing alert ${alert.alertId}: ${error.message}`);
    }
  }
  
  return storedAlerts;
};

/**
 * Lambda handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Promise resolving to Lambda response
 */
export const handler = async (event, context) => {
  try {
    console.log('Starting alert fetch process');
    
    // Extract connector options from event
    const connectorOptions = event.connectorOptions || {};
    
    // Process all connectors
    const alerts = await processAllConnectors(connectorOptions);
    console.log(`Fetched ${alerts.length} alerts from all connectors`);
    
    // Store alerts in DynamoDB
    const storedAlerts = await storeAlerts(alerts);
    console.log(`Stored ${storedAlerts.length} alerts in DynamoDB`);
    
    // Count new and updated alerts
    const newAlerts = storedAlerts.filter(alert => alert.created).length;
    const updatedAlerts = storedAlerts.filter(alert => alert.updated).length;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Alert fetch process completed successfully',
        totalAlerts: alerts.length,
        storedAlerts: storedAlerts.length,
        newAlerts,
        updatedAlerts
      })
    };
  } catch (error) {
    console.error(`Error in alert fetch process: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in alert fetch process',
        error: error.message
      })
    };
  }
};

export default handler;