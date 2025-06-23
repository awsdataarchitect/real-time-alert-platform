/**
 * Database query functions for recommendations
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from environment variables
const RECOMMENDATIONS_TABLE_NAME = process.env.RECOMMENDATIONS_TABLE_NAME || 'recommendationsTable';

/**
 * Save a recommendation to the database
 * 
 * @param {Object} recommendation - The recommendation object to save
 * @returns {Promise<Object>} The saved recommendation
 */
async function saveRecommendation(recommendation) {
  try {
    const params = {
      TableName: RECOMMENDATIONS_TABLE_NAME,
      Item: recommendation
    };
    
    await dynamoDB.put(params).promise();
    return recommendation;
  } catch (error) {
    console.error('Error saving recommendation:', error);
    throw error;
  }
}

/**
 * Get recommendations for an alert
 * 
 * @param {string} alertId - The ID of the alert
 * @returns {Promise<Array>} Array of recommendations for the alert
 */
async function getRecommendationsForAlert(alertId) {
  try {
    const params = {
      TableName: RECOMMENDATIONS_TABLE_NAME,
      IndexName: 'alertId-createdAt-index',
      KeyConditionExpression: 'alertId = :alertId',
      ExpressionAttributeValues: {
        ':alertId': alertId
      },
      ScanIndexForward: false // Get most recent recommendations first
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error retrieving recommendations for alert ${alertId}:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Update a recommendation in the database
 * 
 * @param {string} recommendationId - The ID of the recommendation to update
 * @param {Object} updates - The fields to update
 * @returns {Promise<Object>} The updated recommendation
 */
async function updateRecommendation(recommendationId, updates) {
  try {
    // Build the update expression and attribute values
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    Object.entries(updates).forEach(([key, value], index) => {
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;
      
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = value;
      
      updateExpression += `${index > 0 ? ', ' : ''}${attributeName} = ${attributeValue}`;
    });
    
    // Add updatedAt timestamp
    updateExpression += ', #updatedAtAttr = :updatedAtVal';
    expressionAttributeNames['#updatedAtAttr'] = 'updatedAt';
    expressionAttributeValues[':updatedAtVal'] = new Date().toISOString();
    
    const params = {
      TableName: RECOMMENDATIONS_TABLE_NAME,
      Key: { recommendationId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating recommendation ${recommendationId}:`, error);
    throw error;
  }
}

/**
 * Delete a recommendation from the database
 * 
 * @param {string} recommendationId - The ID of the recommendation to delete
 * @returns {Promise<void>}
 */
async function deleteRecommendation(recommendationId) {
  try {
    const params = {
      TableName: RECOMMENDATIONS_TABLE_NAME,
      Key: { recommendationId }
    };
    
    await dynamoDB.delete(params).promise();
  } catch (error) {
    console.error(`Error deleting recommendation ${recommendationId}:`, error);
    throw error;
  }
}

module.exports = {
  saveRecommendation,
  getRecommendationsForAlert,
  updateRecommendation,
  deleteRecommendation
};