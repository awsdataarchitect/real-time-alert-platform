/**
 * Pattern Detection Lambda Function
 * 
 * This Lambda function analyzes alerts to identify patterns and trends across multiple alerts.
 * It detects potential cascading effects and correlations between different alert types.
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

// Constants for pattern detection
const TIME_WINDOW_HOURS = 24; // Look for patterns within this time window
const GEOGRAPHIC_PROXIMITY_KM = 100; // Consider alerts within this distance as potentially related
const MINIMUM_ALERTS_FOR_PATTERN = 3; // Minimum number of alerts to constitute a pattern
const PATTERN_CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence score to report a pattern

/**
 * Main handler for the pattern detection Lambda
 */
exports.handler = async (event) => {
  try {
    console.log('Pattern Detection Lambda invoked with event:', JSON.stringify(event));
    
    // Get recent alerts from the database
    const recentAlerts = await getRecentAlerts();
    
    if (recentAlerts.length < MINIMUM_ALERTS_FOR_PATTERN) {
      console.log(`Not enough recent alerts (${recentAlerts.length}) to detect patterns. Minimum required: ${MINIMUM_ALERTS_FOR_PATTERN}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not enough alerts to detect patterns' })
      };
    }
    
    // Group alerts by region
    const alertsByRegion = groupAlertsByRegion(recentAlerts);
    
    // Detect patterns in each region
    const detectedPatterns = [];
    
    for (const [region, alerts] of Object.entries(alertsByRegion)) {
      if (alerts.length >= MINIMUM_ALERTS_FOR_PATTERN) {
        const regionalPatterns = await detectPatternsInRegion(region, alerts);
        detectedPatterns.push(...regionalPatterns);
      }
    }
    
    // If patterns were detected, send notifications
    if (detectedPatterns.length > 0) {
      await sendPatternNotifications(detectedPatterns);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Pattern detection completed successfully',
        patternsDetected: detectedPatterns.length,
        patterns: detectedPatterns
      })
    };
  } catch (error) {
    console.error('Error in pattern detection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error detecting patterns', error: error.message })
    };
  }
};

/**
 * Retrieve recent alerts from the database within the specified time window
 */
async function getRecentAlerts() {
  const timeWindowStart = new Date();
  timeWindowStart.setHours(timeWindowStart.getHours() - TIME_WINDOW_HOURS);
  
  const params = {
    TableName: process.env.ALERTS_TABLE,
    FilterExpression: '#createdAt >= :timeWindowStart',
    ExpressionAttributeNames: {
      '#createdAt': 'createdAt'
    },
    ExpressionAttributeValues: {
      ':timeWindowStart': timeWindowStart.toISOString()
    }
  };
  
  const result = await dynamoDB.scan(params).promise();
  return result.Items || [];
}

/**
 * Group alerts by geographic region
 */
function groupAlertsByRegion(alerts) {
  const regions = {};
  
  for (const alert of alerts) {
    if (!alert.location) continue;
    
    // Extract region information from the alert
    // This could be based on geohash, administrative boundaries, or custom regions
    const region = extractRegionFromAlert(alert);
    
    if (!regions[region]) {
      regions[region] = [];
    }
    
    regions[region].push(alert);
  }
  
  return regions;
}

/**
 * Extract region identifier from an alert
 */
function extractRegionFromAlert(alert) {
  // If the alert has a specific region identifier, use that
  if (alert.affectedAreas && alert.affectedAreas.length > 0) {
    return alert.affectedAreas[0].areaId;
  }
  
  // Otherwise, derive a region from coordinates
  // This is a simplified approach - in production, you might use geohashing or administrative boundaries
  if (alert.location && alert.location.coordinates) {
    const [longitude, latitude] = alert.location.coordinates;
    // Create a simple grid-based region identifier by rounding coordinates
    // This groups alerts that are geographically close
    const latGrid = Math.round(latitude * 10) / 10;
    const lonGrid = Math.round(longitude * 10) / 10;
    return `${latGrid},${lonGrid}`;
  }
  
  // Fallback if no location data is available
  return 'unknown-region';
}

/**
 * Detect patterns within alerts from a specific region
 */
async function detectPatternsInRegion(region, alerts) {
  const patterns = [];
  
  // 1. Temporal patterns - sequence of events over time
  const temporalPatterns = detectTemporalPatterns(alerts);
  patterns.push(...temporalPatterns);
  
  // 2. Type correlation patterns - relationships between different alert types
  const correlationPatterns = detectTypeCorrelations(alerts);
  patterns.push(...correlationPatterns);
  
  // 3. Escalation patterns - increasing severity or frequency
  const escalationPatterns = detectEscalationPatterns(alerts);
  patterns.push(...escalationPatterns);
  
  // 4. Cascading effect patterns - one event triggering others
  const cascadingPatterns = detectCascadingEffects(alerts);
  patterns.push(...cascadingPatterns);
  
  // Add region information to all patterns
  return patterns.map(pattern => ({
    ...pattern,
    region,
    detectedAt: new Date().toISOString(),
    confidence: calculatePatternConfidence(pattern, alerts)
  })).filter(pattern => pattern.confidence >= PATTERN_CONFIDENCE_THRESHOLD);
}

/**
 * Detect temporal patterns (sequences of events over time)
 */
function detectTemporalPatterns(alerts) {
  const patterns = [];
  
  // Sort alerts by time
  const sortedAlerts = [...alerts].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  
  // Group alerts by type
  const alertsByType = {};
  for (const alert of sortedAlerts) {
    if (!alertsByType[alert.eventType]) {
      alertsByType[alert.eventType] = [];
    }
    alertsByType[alert.eventType].push(alert);
  }
  
  // Look for increasing frequency of specific alert types
  for (const [eventType, typeAlerts] of Object.entries(alertsByType)) {
    if (typeAlerts.length >= MINIMUM_ALERTS_FOR_PATTERN) {
      // Check if frequency is increasing
      const timeIntervals = [];
      for (let i = 1; i < typeAlerts.length; i++) {
        const timeDiff = new Date(typeAlerts[i].createdAt) - new Date(typeAlerts[i-1].createdAt);
        timeIntervals.push(timeDiff);
      }
      
      // Check if intervals are decreasing (events happening more frequently)
      let decreasingIntervals = true;
      for (let i = 1; i < timeIntervals.length; i++) {
        if (timeIntervals[i] >= timeIntervals[i-1]) {
          decreasingIntervals = false;
          break;
        }
      }
      
      if (decreasingIntervals) {
        patterns.push({
          patternType: 'temporal',
          description: `Increasing frequency of ${eventType} alerts`,
          alertType: eventType,
          alertCount: typeAlerts.length,
          relatedAlertIds: typeAlerts.map(alert => alert.alertId)
        });
      }
    }
  }
  
  return patterns;
}

/**
 * Detect correlations between different alert types
 */
function detectTypeCorrelations(alerts) {
  const patterns = [];
  
  // Group alerts by day to look for co-occurring event types
  const alertsByDay = {};
  for (const alert of alerts) {
    const date = new Date(alert.createdAt);
    const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    
    if (!alertsByDay[dayKey]) {
      alertsByDay[dayKey] = [];
    }
    alertsByDay[dayKey].push(alert);
  }
  
  // Count co-occurrences of event types
  const coOccurrences = {};
  for (const dayAlerts of Object.values(alertsByDay)) {
    const typesOnDay = [...new Set(dayAlerts.map(alert => alert.eventType))];
    
    for (let i = 0; i < typesOnDay.length; i++) {
      for (let j = i + 1; j < typesOnDay.length; j++) {
        const pair = [typesOnDay[i], typesOnDay[j]].sort().join('|');
        
        if (!coOccurrences[pair]) {
          coOccurrences[pair] = {
            count: 0,
            alertIds: []
          };
        }
        
        coOccurrences[pair].count += 1;
        
        // Add alert IDs from this day for this pair
        const typeIAlerts = dayAlerts.filter(alert => alert.eventType === typesOnDay[i]);
        const typeJAlerts = dayAlerts.filter(alert => alert.eventType === typesOnDay[j]);
        const pairAlertIds = [...typeIAlerts, ...typeJAlerts].map(alert => alert.alertId);
        
        coOccurrences[pair].alertIds = [
          ...new Set([...coOccurrences[pair].alertIds, ...pairAlertIds])
        ];
      }
    }
  }
  
  // Find significant co-occurrences
  for (const [pair, data] of Object.entries(coOccurrences)) {
    if (data.count >= Math.ceil(Object.keys(alertsByDay).length / 3)) { // Co-occur in at least 1/3 of days
      const [type1, type2] = pair.split('|');
      patterns.push({
        patternType: 'correlation',
        description: `Correlation between ${type1} and ${type2} alerts`,
        alertTypes: [type1, type2],
        occurrenceCount: data.count,
        relatedAlertIds: data.alertIds
      });
    }
  }
  
  return patterns;
}

/**
 * Detect patterns of escalating severity or impact
 */
function detectEscalationPatterns(alerts) {
  const patterns = [];
  
  // Group alerts by type
  const alertsByType = {};
  for (const alert of alerts) {
    if (!alertsByType[alert.eventType]) {
      alertsByType[alert.eventType] = [];
    }
    alertsByType[alert.eventType].push(alert);
  }
  
  // Check for escalating severity within each type
  for (const [eventType, typeAlerts] of Object.entries(alertsByType)) {
    if (typeAlerts.length >= MINIMUM_ALERTS_FOR_PATTERN) {
      // Sort by time
      const sortedAlerts = [...typeAlerts].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
      // Check if severity is increasing
      let increasingSeverity = true;
      for (let i = 1; i < sortedAlerts.length; i++) {
        if ((sortedAlerts[i].severity || 0) <= (sortedAlerts[i-1].severity || 0)) {
          increasingSeverity = false;
          break;
        }
      }
      
      if (increasingSeverity) {
        patterns.push({
          patternType: 'escalation',
          description: `Escalating severity of ${eventType} alerts`,
          alertType: eventType,
          initialSeverity: sortedAlerts[0].severity,
          currentSeverity: sortedAlerts[sortedAlerts.length - 1].severity,
          alertCount: sortedAlerts.length,
          relatedAlertIds: sortedAlerts.map(alert => alert.alertId)
        });
      }
    }
  }
  
  return patterns;
}

/**
 * Detect potential cascading effects (one event triggering others)
 */
function detectCascadingEffects(alerts) {
  const patterns = [];
  
  // Sort alerts by time
  const sortedAlerts = [...alerts].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  
  // Define known cascading relationships between event types
  const cascadingRelationships = [
    { trigger: 'earthquake', effect: 'tsunami', timeWindowHours: 2 },
    { trigger: 'earthquake', effect: 'landslide', timeWindowHours: 24 },
    { trigger: 'flood', effect: 'waterborne-disease', timeWindowHours: 72 },
    { trigger: 'hurricane', effect: 'flood', timeWindowHours: 48 },
    { trigger: 'wildfire', effect: 'air-quality', timeWindowHours: 24 },
    { trigger: 'heavy-rainfall', effect: 'flood', timeWindowHours: 48 },
    { trigger: 'heavy-rainfall', effect: 'landslide', timeWindowHours: 48 },
    { trigger: 'tornado', effect: 'infrastructure-damage', timeWindowHours: 24 },
    { trigger: 'volcano', effect: 'air-quality', timeWindowHours: 48 },
    { trigger: 'drought', effect: 'wildfire', timeWindowHours: 168 } // 7 days
  ];
  
  // Check for each cascading relationship
  for (const relationship of cascadingRelationships) {
    const triggerAlerts = sortedAlerts.filter(alert => alert.eventType === relationship.trigger);
    const effectAlerts = sortedAlerts.filter(alert => alert.eventType === relationship.effect);
    
    if (triggerAlerts.length > 0 && effectAlerts.length > 0) {
      // Check if effect alerts follow trigger alerts within the time window
      for (const triggerAlert of triggerAlerts) {
        const triggerTime = new Date(triggerAlert.createdAt);
        const timeWindowEnd = new Date(triggerTime);
        timeWindowEnd.setHours(timeWindowEnd.getHours() + relationship.timeWindowHours);
        
        const relatedEffectAlerts = effectAlerts.filter(effectAlert => {
          const effectTime = new Date(effectAlert.createdAt);
          return effectTime > triggerTime && effectTime <= timeWindowEnd;
        });
        
        if (relatedEffectAlerts.length > 0) {
          patterns.push({
            patternType: 'cascading',
            description: `Potential cascading effect: ${relationship.trigger} triggering ${relationship.effect}`,
            triggerType: relationship.trigger,
            effectType: relationship.effect,
            triggerAlertId: triggerAlert.alertId,
            effectAlertIds: relatedEffectAlerts.map(alert => alert.alertId),
            timeWindowHours: relationship.timeWindowHours
          });
        }
      }
    }
  }
  
  return patterns;
}

/**
 * Calculate confidence score for a detected pattern
 */
function calculatePatternConfidence(pattern, allAlerts) {
  let confidence = 0;
  
  switch (pattern.patternType) {
    case 'temporal':
      // Higher confidence with more alerts and clearer frequency increase
      confidence = Math.min(0.5 + (pattern.alertCount / 20), 0.95);
      break;
      
    case 'correlation':
      // Higher confidence with more co-occurrences
      confidence = Math.min(0.6 + (pattern.occurrenceCount / 10), 0.9);
      break;
      
    case 'escalation':
      // Higher confidence with more alerts and greater severity increase
      const severityIncrease = pattern.currentSeverity - pattern.initialSeverity;
      confidence = Math.min(0.6 + (severityIncrease / 10) + (pattern.alertCount / 20), 0.95);
      break;
      
    case 'cascading':
      // Higher confidence based on number of effect alerts and known relationship strength
      const effectCount = pattern.effectAlertIds.length;
      confidence = Math.min(0.7 + (effectCount / 10), 0.95);
      break;
      
    default:
      confidence = 0.5; // Default confidence
  }
  
  return confidence;
}

/**
 * Send notifications about detected patterns
 */
async function sendPatternNotifications(patterns) {
  const topicArn = process.env.PATTERN_NOTIFICATION_TOPIC;
  
  if (!topicArn) {
    console.warn('No SNS topic ARN configured for pattern notifications');
    return;
  }
  
  // Group patterns by confidence level for different notification priorities
  const highConfidencePatterns = patterns.filter(p => p.confidence >= 0.85);
  const mediumConfidencePatterns = patterns.filter(p => p.confidence >= 0.75 && p.confidence < 0.85);
  const lowConfidencePatterns = patterns.filter(p => p.confidence >= PATTERN_CONFIDENCE_THRESHOLD && p.confidence < 0.75);
  
  // Send high confidence patterns immediately
  if (highConfidencePatterns.length > 0) {
    await sendSnsNotification(topicArn, {
      subject: `URGENT: ${highConfidencePatterns.length} High Confidence Alert Patterns Detected`,
      message: 'High confidence alert patterns have been detected that may require immediate attention.',
      priority: 'high',
      patterns: highConfidencePatterns
    });
  }
  
  // Send medium confidence patterns
  if (mediumConfidencePatterns.length > 0) {
    await sendSnsNotification(topicArn, {
      subject: `IMPORTANT: ${mediumConfidencePatterns.length} Alert Patterns Detected`,
      message: 'Alert patterns have been detected that may indicate developing situations.',
      priority: 'medium',
      patterns: mediumConfidencePatterns
    });
  }
  
  // Send low confidence patterns as informational
  if (lowConfidencePatterns.length > 0) {
    await sendSnsNotification(topicArn, {
      subject: `INFO: ${lowConfidencePatterns.length} Potential Alert Patterns`,
      message: 'Potential alert patterns have been detected for monitoring.',
      priority: 'low',
      patterns: lowConfidencePatterns
    });
  }
}

/**
 * Send an SNS notification
 */
async function sendSnsNotification(topicArn, data) {
  const params = {
    TopicArn: topicArn,
    Subject: data.subject,
    Message: JSON.stringify(data, null, 2)
  };
  
  try {
    await sns.publish(params).promise();
    console.log(`Successfully published notification to ${topicArn}`);
  } catch (error) {
    console.error('Error publishing to SNS:', error);
    throw error;
  }
}

// Export additional functions for testing
exports.detectPatternsInRegion = detectPatternsInRegion;
exports.detectTemporalPatterns = detectTemporalPatterns;
exports.detectTypeCorrelations = detectTypeCorrelations;
exports.detectEscalationPatterns = detectEscalationPatterns;
exports.detectCascadingEffects = detectCascadingEffects;
exports.calculatePatternConfidence = calculatePatternConfidence;