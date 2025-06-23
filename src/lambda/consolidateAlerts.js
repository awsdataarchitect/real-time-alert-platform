/**
 * Lambda function for alert consolidation and deduplication
 * 
 * This function identifies similar alerts, detects duplicates, and consolidates
 * related alerts into comprehensive single alerts to reduce alert fatigue and
 * provide more complete information.
 */

import { DynamoDB } from 'aws-sdk';
import stringSimilarity from 'string-similarity';

// Initialize DynamoDB client
const dynamoDB = new DynamoDB.DocumentClient();

// Table names from environment variables
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'Alerts';

// Similarity thresholds
const DUPLICATE_THRESHOLD = 0.9;  // Similarity score above which alerts are considered duplicates
const RELATED_THRESHOLD = 0.7;    // Similarity score above which alerts are considered related

/**
 * Get recent alerts that need consolidation processing
 * @param {number} timeWindowMinutes - Time window in minutes to look back for alerts
 * @param {number} limit - Maximum number of alerts to retrieve
 * @returns {Promise<Array<Object>>} - Promise resolving to array of alerts
 */
export const getRecentAlerts = async (timeWindowMinutes = 60, limit = 100) => {
  try {
    // Calculate timestamp for time window
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
    
    // Query alerts created within the time window
    const params = {
      TableName: ALERTS_TABLE,
      FilterExpression: 'createdAt >= :cutoffTime AND attribute_not_exists(consolidationStatus)',
      ExpressionAttributeValues: {
        ':cutoffTime': cutoffTime
      },
      Limit: limit
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error retrieving recent alerts: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate similarity score between two alerts
 * @param {Object} alert1 - First alert
 * @param {Object} alert2 - Second alert
 * @returns {Object} - Similarity assessment with overall score and component scores
 */
export const calculateAlertSimilarity = (alert1, alert2) => {
  // Initialize component scores
  const scores = {
    headline: 0,
    description: 0,
    location: 0,
    eventType: 0,
    timeOverlap: 0
  };
  
  // Calculate headline similarity if both alerts have headlines
  if (alert1.headline && alert2.headline) {
    scores.headline = stringSimilarity.compareTwoStrings(
      alert1.headline.toLowerCase(),
      alert2.headline.toLowerCase()
    );
  }
  
  // Calculate description similarity if both alerts have descriptions
  if (alert1.description && alert2.description) {
    scores.description = stringSimilarity.compareTwoStrings(
      alert1.description.toLowerCase(),
      alert2.description.toLowerCase()
    );
  }
  
  // Calculate event type similarity if both alerts have event types
  if (alert1.eventType && alert2.eventType) {
    scores.eventType = alert1.eventType === alert2.eventType ? 1 : 0;
  }
  
  // Calculate location similarity if both alerts have locations
  if (alert1.location && alert2.location) {
    // For points, calculate distance-based similarity
    if (alert1.location.type === 'Point' && alert2.location.type === 'Point') {
      const distance = calculateDistance(
        alert1.location.coordinates[1], // latitude
        alert1.location.coordinates[0], // longitude
        alert2.location.coordinates[1], // latitude
        alert2.location.coordinates[0]  // longitude
      );
      
      // Convert distance to similarity score (closer = more similar)
      // Using exponential decay: e^(-distance/50) gives 0.9 at ~5km, 0.5 at ~35km
      scores.location = Math.exp(-distance / 50);
    } 
    // For geohashes, compare directly
    else if (alert1.geospatialData?.geohash && alert2.geospatialData?.geohash) {
      const geohash1 = alert1.geospatialData.geohash;
      const geohash2 = alert2.geospatialData.geohash;
      
      // Calculate similarity based on common prefix length
      const commonPrefixLength = getCommonPrefixLength(geohash1, geohash2);
      scores.location = commonPrefixLength / Math.max(geohash1.length, geohash2.length);
    }
  }
  
  // Calculate time overlap if both alerts have time ranges
  if (alert1.startTime && alert1.endTime && alert2.startTime && alert2.endTime) {
    const overlap = calculateTimeOverlap(
      new Date(alert1.startTime),
      new Date(alert1.endTime || alert1.startTime),
      new Date(alert2.startTime),
      new Date(alert2.endTime || alert2.startTime)
    );
    
    scores.timeOverlap = overlap;
  }
  
  // Calculate weighted overall similarity score
  const weights = {
    headline: 0.25,
    description: 0.25,
    location: 0.3,
    eventType: 0.1,
    timeOverlap: 0.1
  };
  
  let overallScore = 0;
  let totalWeight = 0;
  
  // Only include components that have valid scores
  for (const [component, score] of Object.entries(scores)) {
    if (!isNaN(score)) {
      overallScore += score * weights[component];
      totalWeight += weights[component];
    }
  }
  
  // Normalize by total weight used
  overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;
  
  return {
    overallScore,
    componentScores: scores
  };
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
export const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Get length of common prefix between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Length of common prefix
 */
export const getCommonPrefixLength = (str1, str2) => {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return i;
};

/**
 * Calculate time overlap between two time ranges
 * @param {Date} start1 - Start time of first range
 * @param {Date} end1 - End time of first range
 * @param {Date} start2 - Start time of second range
 * @param {Date} end2 - End time of second range
 * @returns {number} - Overlap score between 0 and 1
 */
export const calculateTimeOverlap = (start1, end1, start2, end2) => {
  // Check if ranges overlap
  if (end1 < start2 || end2 < start1) {
    return 0; // No overlap
  }
  
  // Calculate overlap duration
  const overlapStart = new Date(Math.max(start1, start2));
  const overlapEnd = new Date(Math.min(end1, end2));
  const overlapDuration = overlapEnd - overlapStart;
  
  // Calculate total duration of both ranges
  const duration1 = end1 - start1;
  const duration2 = end2 - start2;
  const totalDuration = duration1 + duration2;
  
  // Calculate overlap ratio (0 to 1)
  return totalDuration > 0 ? overlapDuration / (totalDuration / 2) : 0;
};

/**
 * Find groups of similar alerts
 * @param {Array<Object>} alerts - Array of alerts to group
 * @returns {Array<Array<Object>>} - Array of alert groups
 */
export const findSimilarAlertGroups = (alerts) => {
  const groups = [];
  const processedAlerts = new Set();
  
  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    
    // Skip if this alert has already been processed
    if (processedAlerts.has(alert.id)) {
      continue;
    }
    
    // Start a new group with this alert
    const group = [alert];
    processedAlerts.add(alert.id);
    
    // Find similar alerts
    for (let j = 0; j < alerts.length; j++) {
      if (i === j) continue;
      
      const otherAlert = alerts[j];
      
      // Skip if this alert has already been processed
      if (processedAlerts.has(otherAlert.id)) {
        continue;
      }
      
      // Calculate similarity
      const similarity = calculateAlertSimilarity(alert, otherAlert);
      
      // Add to group if similar enough
      if (similarity.overallScore >= RELATED_THRESHOLD) {
        group.push(otherAlert);
        processedAlerts.add(otherAlert.id);
      }
    }
    
    // Only add groups with multiple alerts or duplicates
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
};

/**
 * Consolidate a group of similar alerts into a single comprehensive alert
 * @param {Array<Object>} alertGroup - Group of similar alerts
 * @returns {Object} - Consolidated alert
 */
export const consolidateAlertGroup = (alertGroup) => {
  // Sort alerts by creation time (newest first)
  const sortedAlerts = [...alertGroup].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  // Use the newest alert as the base
  const baseAlert = sortedAlerts[0];
  
  // Prepare consolidated alert
  const consolidatedAlert = {
    ...baseAlert,
    consolidatedFrom: alertGroup.map(alert => alert.id),
    sourceCount: alertGroup.length,
    sources: alertGroup.map(alert => ({
      id: alert.id,
      sourceId: alert.sourceId,
      sourceType: alert.sourceType,
      createdAt: alert.createdAt
    })),
    updatedAt: new Date().toISOString()
  };
  
  // Enhance description by combining unique information
  if (alertGroup.length > 1) {
    // Extract unique sentences from all descriptions
    const allSentences = new Set();
    alertGroup.forEach(alert => {
      if (alert.description) {
        const sentences = alert.description
          .split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        sentences.forEach(sentence => allSentences.add(sentence));
      }
    });
    
    // Combine unique sentences into enhanced description
    if (allSentences.size > 0) {
      consolidatedAlert.enhancedDescription = Array.from(allSentences).join('. ') + '.';
    }
  }
  
  // Determine most accurate location data
  if (alertGroup.some(alert => alert.geospatialData)) {
    // Find alert with most detailed geospatial data
    const alertWithBestGeoData = alertGroup
      .filter(alert => alert.geospatialData)
      .sort((a, b) => {
        // Prioritize alerts with affected area data
        const aHasAffectedArea = a.geospatialData.affectedArea ? 1 : 0;
        const bHasAffectedArea = b.geospatialData.affectedArea ? 1 : 0;
        
        if (aHasAffectedArea !== bHasAffectedArea) {
          return bHasAffectedArea - aHasAffectedArea;
        }
        
        // Then prioritize by geohash precision
        return (b.geospatialData.geohash?.length || 0) - (a.geospatialData.geohash?.length || 0);
      })[0];
    
    if (alertWithBestGeoData) {
      consolidatedAlert.geospatialData = alertWithBestGeoData.geospatialData;
    }
  }
  
  // Combine any unique parameters
  const combinedParameters = {};
  alertGroup.forEach(alert => {
    if (alert.parameters) {
      Object.entries(alert.parameters).forEach(([key, value]) => {
        // Only add if not already present or if the new value is more detailed
        if (!combinedParameters[key] || 
            (typeof value === 'string' && value.length > combinedParameters[key].length)) {
          combinedParameters[key] = value;
        }
      });
    }
  });
  
  if (Object.keys(combinedParameters).length > 0) {
    consolidatedAlert.parameters = combinedParameters;
  }
  
  // Use the most severe classification if available
  if (alertGroup.some(alert => alert.aiClassification)) {
    const alertsWithClassification = alertGroup.filter(alert => alert.aiClassification);
    
    if (alertsWithClassification.length > 0) {
      // Sort by severity level (highest first)
      const sortedByClassification = alertsWithClassification.sort((a, b) => 
        (b.aiClassification.severityLevel || 0) - (a.aiClassification.severityLevel || 0)
      );
      
      consolidatedAlert.aiClassification = sortedByClassification[0].aiClassification;
    }
  }
  
  return consolidatedAlert;
};

/**
 * Mark alerts as consolidated in DynamoDB
 * @param {Array<string>} alertIds - IDs of alerts to mark
 * @param {string} consolidatedAlertId - ID of the consolidated alert
 * @returns {Promise<void>} - Promise resolving when updates are complete
 */
export const markAlertsAsConsolidated = async (alertIds, consolidatedAlertId) => {
  try {
    // Process in batches to avoid DynamoDB limits
    const batchSize = 25;
    for (let i = 0; i < alertIds.length; i += batchSize) {
      const batch = alertIds.slice(i, i + batchSize);
      
      const updatePromises = batch.map(alertId => {
        const params = {
          TableName: ALERTS_TABLE,
          Key: { id: alertId },
          UpdateExpression: 'set consolidationStatus = :status, consolidatedInto = :consolidatedId, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':status': 'CONSOLIDATED',
            ':consolidatedId': consolidatedAlertId,
            ':updatedAt': new Date().toISOString()
          }
        };
        
        return dynamoDB.update(params).promise();
      });
      
      await Promise.all(updatePromises);
    }
  } catch (error) {
    console.error(`Error marking alerts as consolidated: ${error.message}`);
    throw error;
  }
};

/**
 * Create consolidated alert in DynamoDB
 * @param {Object} consolidatedAlert - Consolidated alert to create
 * @returns {Promise<Object>} - Promise resolving to created alert
 */
export const createConsolidatedAlert = async (consolidatedAlert) => {
  try {
    // Generate a new ID for the consolidated alert
    const consolidatedId = `consolidated-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const params = {
      TableName: ALERTS_TABLE,
      Item: {
        ...consolidatedAlert,
        id: consolidatedId,
        consolidationStatus: 'PRIMARY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    
    await dynamoDB.put(params).promise();
    
    return {
      ...params.Item
    };
  } catch (error) {
    console.error(`Error creating consolidated alert: ${error.message}`);
    throw error;
  }
};

/**
 * Process a batch of alerts for consolidation
 * @param {Array<Object>} alerts - Alerts to process
 * @returns {Promise<Object>} - Promise resolving to processing results
 */
export const processAlertBatch = async (alerts) => {
  const results = {
    total: alerts.length,
    groupsFound: 0,
    alertsConsolidated: 0,
    consolidatedAlertsCreated: 0,
    details: []
  };
  
  try {
    // Find groups of similar alerts
    const similarGroups = findSimilarAlertGroups(alerts);
    results.groupsFound = similarGroups.length;
    
    // Process each group
    for (const group of similarGroups) {
      // Skip groups with only one alert
      if (group.length <= 1) continue;
      
      // Consolidate the group
      const consolidatedAlert = consolidateAlertGroup(group);
      
      // Create the consolidated alert
      const createdAlert = await createConsolidatedAlert(consolidatedAlert);
      
      // Mark original alerts as consolidated
      const alertIds = group.map(alert => alert.id);
      await markAlertsAsConsolidated(alertIds, createdAlert.id);
      
      results.alertsConsolidated += group.length;
      results.consolidatedAlertsCreated++;
      
      results.details.push({
        consolidatedAlertId: createdAlert.id,
        originalAlertCount: group.length,
        originalAlertIds: alertIds
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error in alert consolidation process: ${error.message}`);
    throw error;
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
    console.log('Starting alert consolidation process');
    
    // Get parameters from event or use defaults
    const timeWindowMinutes = event.timeWindowMinutes || 60;
    const batchSize = event.batchSize || 100;
    
    // Get recent alerts
    const alerts = await getRecentAlerts(timeWindowMinutes, batchSize);
    console.log(`Retrieved ${alerts.length} alerts for consolidation processing`);
    
    if (alerts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No alerts to consolidate',
          results: {
            total: 0,
            groupsFound: 0,
            alertsConsolidated: 0,
            consolidatedAlertsCreated: 0
          }
        })
      };
    }
    
    // Process the alerts
    const results = await processAlertBatch(alerts);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Alert consolidation completed',
        results
      })
    };
  } catch (error) {
    console.error(`Error in alert consolidation process: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in alert consolidation process',
        error: error.message
      })
    };
  }
};

export default handler;