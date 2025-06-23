/**
 * Lambda function to poll data sources at scheduled intervals
 * 
 * This function is triggered by EventBridge rules to poll data from external APIs,
 * normalize them to the platform's alert format, and store them in DynamoDB.
 * It includes caching mechanisms to prevent duplicate processing.
 */

import { DynamoDB } from 'aws-sdk';
import { processAllConnectors, getConnector } from '../services/connectors';

// Initialize DynamoDB client
const dynamoDB = new DynamoDB.DocumentClient();
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'alerts';
const CACHE_TABLE = process.env.CACHE_TABLE || 'alert-cache';

/**
 * Get cached data for a source
 * @param {string} sourceId - Source identifier
 * @returns {Promise<Object|null>} - Promise resolving to cached data or null if not found
 */
const getCachedData = async (sourceId) => {
  try {
    const result = await dynamoDB.get({
      TableName: CACHE_TABLE,
      Key: { sourceId }
    }).promise();
    
    return result.Item || null;
  } catch (error) {
    console.error(`Error getting cached data for ${sourceId}: ${error.message}`);
    return null;
  }
};

/**
 * Update cache for a source
 * @param {string} sourceId - Source identifier
 * @param {Object} cacheData - Data to cache
 * @returns {Promise<boolean>} - Promise resolving to true if successful
 */
const updateCache = async (sourceId, cacheData) => {
  try {
    await dynamoDB.put({
      TableName: CACHE_TABLE,
      Item: {
        sourceId,
        lastPolled: new Date().toISOString(),
        lastProcessedIds: cacheData.processedIds || [],
        etag: cacheData.etag || null,
        lastModified: cacheData.lastModified || null,
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hour TTL
      }
    }).promise();
    
    return true;
  } catch (error) {
    console.error(`Error updating cache for ${sourceId}: ${error.message}`);
    return false;
  }
};

/**
 * Store alerts in DynamoDB with deduplication
 * @param {Array<Object>} alerts - Normalized alerts to store
 * @param {Object} cacheData - Cache data for deduplication
 * @returns {Promise<Object>} - Promise resolving to storage results
 */
const storeAlerts = async (alerts, cacheData) => {
  const results = {
    total: alerts.length,
    new: 0,
    updated: 0,
    duplicate: 0,
    failed: 0
  };
  
  const processedIds = new Set(cacheData?.lastProcessedIds || []);
  const newProcessedIds = new Set(processedIds);
  
  for (const alert of alerts) {
    try {
      // Skip if this alert ID was already processed recently
      if (processedIds.has(alert.alertId)) {
        results.duplicate++;
        continue;
      }
      
      // Add to processed IDs set
      newProcessedIds.add(alert.alertId);
      
      // Check if alert already exists in database
      const existingAlert = await dynamoDB.get({
        TableName: ALERTS_TABLE,
        Key: { alertId: alert.alertId }
      }).promise();
      
      if (existingAlert.Item) {
        // If alert exists and has been updated, update it
        if (new Date(alert.updatedAt) > new Date(existingAlert.Item.updatedAt)) {
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
          
          results.updated++;
        } else {
          results.duplicate++;
        }
      } else {
        // If alert doesn't exist, create it
        await dynamoDB.put({
          TableName: ALERTS_TABLE,
          Item: alert
        }).promise();
        
        results.new++;
      }
    } catch (error) {
      console.error(`Error storing alert ${alert.alertId}: ${error.message}`);
      results.failed++;
    }
  }
  
  // Return the updated processed IDs for cache update
  return {
    results,
    processedIds: Array.from(newProcessedIds)
  };
};

/**
 * Poll a specific data source
 * @param {string} sourceType - Type of source to poll
 * @param {Object} options - Options for the connector
 * @returns {Promise<Object>} - Promise resolving to polling results
 */
export const pollDataSource = async (sourceType, options = {}) => {
  try {
    console.log(`Polling data source: ${sourceType}`);
    
    // Get connector for this source type
    const connector = getConnector(sourceType, options);
    const sourceId = connector.sourceId;
    
    // Get cached data for this source
    const cacheData = await getCachedData(sourceId);
    
    // Add cache headers to options if available
    if (cacheData) {
      options.cacheHeaders = {
        etag: cacheData.etag,
        lastModified: cacheData.lastModified
      };
    }
    
    // Process data from connector
    const alerts = await connector.processData();
    console.log(`Fetched ${alerts.length} alerts from ${sourceType}`);
    
    // Store alerts with deduplication
    const storageResult = await storeAlerts(alerts, cacheData);
    
    // Update cache with new processed IDs and headers
    const newCacheData = {
      processedIds: storageResult.processedIds,
      etag: options.responseHeaders?.etag || cacheData?.etag,
      lastModified: options.responseHeaders?.lastModified || cacheData?.lastModified
    };
    
    await updateCache(sourceId, newCacheData);
    
    return {
      sourceType,
      sourceId,
      results: storageResult.results
    };
  } catch (error) {
    console.error(`Error polling data source ${sourceType}: ${error.message}`);
    return {
      sourceType,
      error: error.message
    };
  }
};

/**
 * Lambda handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Promise resolving to Lambda response
 */
export const handler = async (event, context) => {
  try {
    console.log('Starting scheduled data polling');
    
    // Extract source types and options from event
    const sourceTypes = event.sourceTypes || ['usgs', 'noaa', 'cdc'];
    const options = event.options || {};
    
    // Poll each data source
    const results = await Promise.all(
      sourceTypes.map(sourceType => pollDataSource(sourceType, options[sourceType] || {}))
    );
    
    // Calculate summary statistics
    const summary = {
      total: 0,
      new: 0,
      updated: 0,
      duplicate: 0,
      failed: 0,
      errors: 0
    };
    
    results.forEach(result => {
      if (result.error) {
        summary.errors++;
      } else {
        summary.total += result.results.total;
        summary.new += result.results.new;
        summary.updated += result.results.updated;
        summary.duplicate += result.results.duplicate;
        summary.failed += result.results.failed;
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data polling completed',
        summary,
        results
      })
    };
  } catch (error) {
    console.error(`Error in data polling process: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in data polling process',
        error: error.message
      })
    };
  }
};

export default handler;