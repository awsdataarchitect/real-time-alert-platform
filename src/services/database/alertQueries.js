/**
 * Database query functions for alerts
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table names from environment variables
const ALERTS_TABLE_NAME = process.env.ALERTS_TABLE_NAME || 'alertsTable';

/**
 * Get an alert by its ID
 * 
 * @param {string} alertId - The ID of the alert to retrieve
 * @returns {Promise<Object|null>} The alert object or null if not found
 */
async function getAlertById(alertId) {
  try {
    const params = {
      TableName: ALERTS_TABLE_NAME,
      Key: { alertId }
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error(`Error retrieving alert ${alertId}:`, error);
    throw error;
  }
}

/**
 * Get related historical alerts based on the current alert
 * 
 * @param {Object} currentAlert - The current alert object
 * @param {number} limit - Maximum number of historical alerts to retrieve (default: 10)
 * @returns {Promise<Array>} Array of related historical alerts
 */
async function getRelatedHistoricalAlerts(currentAlert, limit = 10) {
  try {
    // Extract relevant information for querying
    const { eventType, subType, location } = currentAlert;
    
    // Query parameters for finding related alerts
    const params = {
      TableName: ALERTS_TABLE_NAME,
      IndexName: 'eventType-createdAt-index',
      KeyConditionExpression: 'eventType = :eventType',
      FilterExpression: 'alertId <> :currentAlertId',
      ExpressionAttributeValues: {
        ':eventType': eventType,
        ':currentAlertId': currentAlert.alertId
      },
      Limit: limit,
      ScanIndexForward: false // Get most recent alerts first
    };
    
    // Add subType filter if available
    if (subType) {
      params.FilterExpression += ' AND subType = :subType';
      params.ExpressionAttributeValues[':subType'] = subType;
    }
    
    // Execute the query
    const result = await dynamoDB.query(params).promise();
    
    // If we have location data, filter results by proximity
    let alerts = result.Items || [];
    if (location && location.coordinates) {
      alerts = filterAlertsByProximity(alerts, location, 100); // 100km radius
    }
    
    // Enrich alerts with outcome data if available
    return await enrichAlertsWithOutcomes(alerts);
  } catch (error) {
    console.error('Error retrieving related historical alerts:', error);
    return []; // Return empty array on error
  }
}

/**
 * Filter alerts by proximity to a location
 * 
 * @param {Array} alerts - Array of alerts to filter
 * @param {Object} location - Location object with coordinates
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array} Filtered alerts within the radius
 */
function filterAlertsByProximity(alerts, location, radiusKm) {
  // Simple implementation - in a real system, use a proper geospatial library
  return alerts.filter(alert => {
    if (!alert.location || !alert.location.coordinates) return false;
    
    // Calculate rough distance (this is simplified)
    const distance = calculateDistance(
      location.coordinates[1], location.coordinates[0],
      alert.location.coordinates[1], alert.location.coordinates[0]
    );
    
    return distance <= radiusKm;
  });
}

/**
 * Calculate distance between two points using Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Enrich alerts with outcome data from the outcomes table
 * 
 * @param {Array} alerts - Array of alerts to enrich
 * @returns {Promise<Array>} Enriched alerts with outcome data
 */
async function enrichAlertsWithOutcomes(alerts) {
  try {
    // In a real implementation, this would query a separate outcomes table
    // For now, we'll just return the alerts as-is with mock outcome data for some
    
    return alerts.map(alert => {
      // Add mock outcome data for demonstration purposes
      if (Math.random() > 0.5) {
        alert.effectiveActions = [
          'Early evacuation of affected areas',
          'Deployment of emergency response teams',
          'Public communication through multiple channels'
        ];
        
        alert.outcomes = [
          'Reduced casualties',
          'Effective resource allocation',
          'Timely public response'
        ];
      }
      
      return alert;
    });
  } catch (error) {
    console.error('Error enriching alerts with outcomes:', error);
    return alerts; // Return original alerts on error
  }
}

module.exports = {
  getAlertById,
  getRelatedHistoricalAlerts
};