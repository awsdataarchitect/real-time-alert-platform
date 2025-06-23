/**
 * Lambda function for geospatial processing of alerts
 * 
 * This function processes alerts with location data to determine affected areas,
 * calculate geohashes for efficient geospatial queries, and update alerts with
 * enhanced geospatial information.
 */

import { DynamoDB } from 'aws-sdk';
import * as turf from '@turf/turf';
import { 
  encodeGeohash, 
  decodeGeohash, 
  getNeighbors, 
  getGeohashFromGeoJson 
} from '../utils/geohash';

// Initialize DynamoDB client
const dynamoDB = new DynamoDB.DocumentClient();

// Table names from environment variables
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'Alerts';

/**
 * Get alerts that need geospatial processing
 * @param {number} limit - Maximum number of alerts to retrieve
 * @returns {Promise<Array<Object>>} - Promise resolving to array of alerts
 */
export const getAlertsForProcessing = async (limit = 10) => {
  try {
    // Query alerts that have location data but no processed geospatial data
    const params = {
      TableName: ALERTS_TABLE,
      FilterExpression: 'attribute_exists(location) AND attribute_not_exists(geospatialData)',
      Limit: limit
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error retrieving alerts for geospatial processing: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate geohash for an alert's location
 * @param {Object} alert - Alert with location data
 * @returns {string} - Geohash string
 */
export const calculateGeohash = (alert) => {
  if (!alert.location) {
    throw new Error('Alert does not have location data');
  }
  
  try {
    return getGeohashFromGeoJson(alert.location);
  } catch (error) {
    console.error(`Error calculating geohash for alert ${alert.id}: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate neighboring geohashes for an alert
 * @param {string} geohash - Base geohash
 * @param {number} precision - Precision to use for neighbors (default: same as base geohash)
 * @returns {Array<string>} - Array of neighboring geohashes
 */
export const calculateNeighboringGeohashes = (geohash, precision = geohash.length) => {
  try {
    const neighbors = getNeighbors(geohash);
    return Object.values(neighbors);
  } catch (error) {
    console.error(`Error calculating neighboring geohashes: ${error.message}`);
    throw error;
  }
};

/**
 * Determine affected area for an alert
 * @param {Object} alert - Alert with location data
 * @returns {Object} - GeoJSON object representing affected area
 */
export const determineAffectedArea = (alert) => {
  if (!alert.location) {
    throw new Error('Alert does not have location data');
  }
  
  try {
    // Different logic based on alert type and location type
    switch (alert.location.type) {
      case 'Point': {
        // For point locations, create a buffer based on severity and event type
        const coordinates = alert.location.coordinates;
        const point = turf.point([coordinates[0], coordinates[1]]);
        
        // Calculate buffer radius based on alert properties
        let radiusKm = 5; // Default radius in kilometers
        
        // Adjust radius based on severity if available
        if (alert.severity) {
          radiusKm = Math.max(1, alert.severity * 2); // Scale with severity
        }
        
        // Adjust radius based on event type if available
        if (alert.eventType) {
          const eventType = alert.eventType.toLowerCase();
          
          if (eventType.includes('earthquake')) {
            // Earthquakes affect larger areas based on magnitude
            const magnitude = alert.parameters?.magnitude || 5;
            radiusKm = Math.pow(10, magnitude / 2); // Logarithmic scale
          } else if (eventType.includes('tornado')) {
            // Tornados typically affect a path
            radiusKm = 2;
          } else if (eventType.includes('hurricane') || eventType.includes('cyclone')) {
            // Hurricanes affect very large areas
            radiusKm = 100;
          } else if (eventType.includes('flood')) {
            // Floods affect areas based on terrain, using moderate default
            radiusKm = 20;
          }
        }
        
        // Create buffer
        const buffer = turf.buffer(point, radiusKm, { units: 'kilometers' });
        return buffer.geometry;
      }
      
      case 'Polygon':
        // For polygon locations, use as is or add a small buffer
        const polygon = turf.polygon(alert.location.coordinates);
        const buffer = turf.buffer(polygon, 1, { units: 'kilometers' });
        return buffer.geometry;
        
      case 'MultiPolygon':
        // For multi-polygon locations, use as is
        return alert.location;
        
      default:
        throw new Error(`Unsupported location type: ${alert.location.type}`);
    }
  } catch (error) {
    console.error(`Error determining affected area for alert ${alert.id}: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate population impact estimate based on affected area
 * @param {Object} affectedArea - GeoJSON object representing affected area
 * @returns {Object} - Population impact estimate
 */
export const estimatePopulationImpact = (affectedArea) => {
  // In a real implementation, this would query a population density database
  // For this example, we'll return a placeholder estimate
  
  try {
    // Calculate area in square kilometers
    const area = turf.area(affectedArea) / 1000000; // Convert from m² to km²
    
    // Placeholder logic - in reality would use population density data
    const estimatedDensity = 100; // people per km²
    const estimatedPopulation = Math.round(area * estimatedDensity);
    
    return {
      areaKm2: area.toFixed(2),
      estimatedPopulation,
      densityEstimate: 'medium', // low, medium, high
      confidence: 'low' // Would be based on data quality in real implementation
    };
  } catch (error) {
    console.error(`Error estimating population impact: ${error.message}`);
    return {
      areaKm2: 0,
      estimatedPopulation: 0,
      densityEstimate: 'unknown',
      confidence: 'none',
      error: error.message
    };
  }
};

/**
 * Update alert with geospatial data in DynamoDB
 * @param {string} alertId - ID of the alert to update
 * @param {string} sourceId - Source ID of the alert
 * @param {Object} geospatialData - Geospatial data to add to the alert
 * @returns {Promise<Object>} - Promise resolving to update result
 */
export const updateAlertGeospatialData = async (alertId, sourceId, geospatialData) => {
  try {
    const params = {
      TableName: ALERTS_TABLE,
      Key: { 
        id: alertId,
        sourceId: sourceId
      },
      UpdateExpression: 'set geospatialData = :geospatialData, locationHash = :locationHash, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':geospatialData': geospatialData,
        ':locationHash': geospatialData.geohash,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating alert geospatial data: ${error.message}`);
    throw error;
  }
};

/**
 * Process a single alert for geospatial analysis
 * @param {Object} alert - Alert to process
 * @returns {Promise<Object>} - Promise resolving to processing result
 */
export const processAlert = async (alert) => {
  try {
    // Skip alerts without location data
    if (!alert.location) {
      return { 
        alertId: alert.id, 
        status: 'skipped', 
        reason: 'No location data' 
      };
    }
    
    // Calculate geohash
    const geohash = calculateGeohash(alert);
    
    // Calculate neighboring geohashes
    const neighboringGeohashes = calculateNeighboringGeohashes(geohash);
    
    // Determine affected area
    const affectedArea = determineAffectedArea(alert);
    
    // Estimate population impact
    const populationImpact = estimatePopulationImpact(affectedArea);
    
    // Prepare geospatial data
    const geospatialData = {
      geohash,
      neighboringGeohashes,
      affectedArea,
      populationImpact,
      processedAt: new Date().toISOString()
    };
    
    // Update alert with geospatial data
    await updateAlertGeospatialData(alert.id, alert.sourceId, geospatialData);
    
    return {
      alertId: alert.id,
      status: 'processed',
      geohash,
      affectedAreaType: affectedArea.type
    };
  } catch (error) {
    console.error(`Error processing geospatial data for alert ${alert.id}: ${error.message}`);
    return {
      alertId: alert.id,
      status: 'failed',
      error: error.message
    };
  }
};

/**
 * Process a batch of alerts for geospatial analysis
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
      console.error(`Unexpected error processing alert ${alert.id}: ${error.message}`);
      results.failed++;
      results.details.push({
        alertId: alert.id,
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
    console.log('Starting geospatial processing');
    
    // Get batch size from event or use default
    const batchSize = event.batchSize || 10;
    
    // Get alerts for processing
    const alerts = await getAlertsForProcessing(batchSize);
    console.log(`Retrieved ${alerts.length} alerts for geospatial processing`);
    
    if (alerts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No alerts to process',
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
        message: 'Geospatial processing completed',
        results
      })
    };
  } catch (error) {
    console.error(`Error in geospatial processing: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in geospatial processing',
        error: error.message
      })
    };
  }
};

export default handler;