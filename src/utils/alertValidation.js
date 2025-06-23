/**
 * Alert validation utilities
 */
import { getGeohashFromGeoJson } from './geohash';

/**
 * Validates an alert object
 * @param {Object} alert - The alert object to validate
 * @returns {Object} Object with isValid and errors properties
 */
export const validateAlert = (alert) => {
  const errors = [];

  // Required fields
  const requiredFields = [
    'sourceId',
    'sourceType',
    'category',
    'eventType',
    'severity',
    'certainty',
    'headline',
    'description',
    'startTime',
    'status',
    'location'
  ];

  requiredFields.forEach(field => {
    if (!alert[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate location
  if (alert.location) {
    if (!alert.location.type || !alert.location.coordinates) {
      errors.push('Location must have type and coordinates');
    } else {
      // Validate location type
      const validTypes = ['Point', 'Polygon', 'MultiPolygon'];
      if (!validTypes.includes(alert.location.type)) {
        errors.push(`Invalid location type: ${alert.location.type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Validate coordinates based on type
      try {
        switch (alert.location.type) {
          case 'Point':
            if (!Array.isArray(alert.location.coordinates) || alert.location.coordinates.length !== 2) {
              errors.push('Point coordinates must be an array of [longitude, latitude]');
            }
            break;
          case 'Polygon':
            if (!Array.isArray(alert.location.coordinates) || !Array.isArray(alert.location.coordinates[0])) {
              errors.push('Polygon coordinates must be an array of arrays of [longitude, latitude]');
            }
            break;
          case 'MultiPolygon':
            if (!Array.isArray(alert.location.coordinates) || !Array.isArray(alert.location.coordinates[0]) || !Array.isArray(alert.location.coordinates[0][0])) {
              errors.push('MultiPolygon coordinates must be an array of arrays of arrays of [longitude, latitude]');
            }
            break;
        }
      } catch (error) {
        errors.push(`Error validating coordinates: ${error.message}`);
      }
    }
  }

  // Validate dates
  if (alert.startTime && alert.endTime) {
    const startTime = new Date(alert.startTime);
    const endTime = new Date(alert.endTime);
    if (endTime < startTime) {
      errors.push('End time must be after start time');
    }
  }

  // Validate affected areas
  if (alert.affectedAreas && Array.isArray(alert.affectedAreas)) {
    alert.affectedAreas.forEach((area, index) => {
      if (!area.areaId || !area.areaName || !area.areaType || !area.geometry) {
        errors.push(`Affected area at index ${index} is missing required fields`);
      }
    });
  }

  // Validate resources
  if (alert.resources && Array.isArray(alert.resources)) {
    alert.resources.forEach((resource, index) => {
      if (!resource.resourceType || !resource.mimeType || !resource.uri) {
        errors.push(`Resource at index ${index} is missing required fields`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Prepares an alert object for storage by adding derived fields
 * @param {Object} alert - The alert object to prepare
 * @returns {Object} The prepared alert object
 */
export const prepareAlertForStorage = (alert) => {
  const preparedAlert = { ...alert };

  // Add locationHash if not present
  if (alert.location && !alert.locationHash) {
    try {
      preparedAlert.locationHash = getGeohashFromGeoJson(alert.location);
    } catch (error) {
      console.error('Error generating locationHash:', error);
    }
  }

  // Add version if not present
  if (!preparedAlert.version) {
    preparedAlert.version = 1;
  }

  // Add timestamps if not present
  const now = new Date().toISOString();
  if (!preparedAlert.createdAt) {
    preparedAlert.createdAt = now;
  }
  preparedAlert.updatedAt = now;

  return preparedAlert;
};

/**
 * Checks if two alerts are duplicates or related
 * @param {Object} alert1 - First alert
 * @param {Object} alert2 - Second alert
 * @returns {Object} Object with isDuplicate and similarity properties
 */
export const checkAlertSimilarity = (alert1, alert2) => {
  let similarityScore = 0;
  const maxScore = 10;
  
  // Check if they have the same source ID
  if (alert1.sourceId === alert2.sourceId) {
    return { isDuplicate: true, similarity: maxScore };
  }
  
  // Check event type
  if (alert1.eventType === alert2.eventType) {
    similarityScore += 2;
  }
  
  // Check category
  if (alert1.category === alert2.category) {
    similarityScore += 2;
  }
  
  // Check location proximity
  if (alert1.locationHash && alert2.locationHash) {
    // Compare first 5 characters of geohash for rough proximity
    const precision = Math.min(5, Math.min(alert1.locationHash.length, alert2.locationHash.length));
    if (alert1.locationHash.substring(0, precision) === alert2.locationHash.substring(0, precision)) {
      similarityScore += 3;
    }
  }
  
  // Check time proximity
  const startTime1 = new Date(alert1.startTime);
  const startTime2 = new Date(alert2.startTime);
  const timeDiffHours = Math.abs(startTime1 - startTime2) / (1000 * 60 * 60);
  
  if (timeDiffHours < 1) {
    similarityScore += 2;
  } else if (timeDiffHours < 6) {
    similarityScore += 1;
  }
  
  // Check headline similarity (simple check for now)
  if (alert1.headline && alert2.headline) {
    const headline1Words = new Set(alert1.headline.toLowerCase().split(/\s+/));
    const headline2Words = new Set(alert2.headline.toLowerCase().split(/\s+/));
    
    let commonWords = 0;
    headline1Words.forEach(word => {
      if (headline2Words.has(word) && word.length > 3) { // Only count significant words
        commonWords++;
      }
    });
    
    const similarityRatio = commonWords / Math.max(headline1Words.size, headline2Words.size);
    if (similarityRatio > 0.7) {
      similarityScore += 1;
    }
  }
  
  return {
    isDuplicate: similarityScore >= 8,
    similarity: similarityScore
  };
};