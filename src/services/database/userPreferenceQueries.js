/**
 * Database query functions for user preferences
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from environment variables
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || 'usersTable';

/**
 * Get user preferences by user ID
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object|null>} The user preferences or null if not found
 */
async function getUserPreferences(userId) {
  try {
    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      ProjectionExpression: 'id, username, alertPreferences, notificationChannels, locations, profile'
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error(`Error retrieving user preferences for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user alert preferences
 * 
 * @param {string} userId - The ID of the user
 * @param {Object} alertPreferences - The alert preferences to update
 * @returns {Promise<Object>} The updated user preferences
 */
async function updateAlertPreferences(userId, alertPreferences) {
  try {
    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      UpdateExpression: 'SET alertPreferences = :alertPreferences, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':alertPreferences': alertPreferences,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating alert preferences for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user notification channels
 * 
 * @param {string} userId - The ID of the user
 * @param {Array} notificationChannels - The notification channels to update
 * @returns {Promise<Object>} The updated user preferences
 */
async function updateNotificationChannels(userId, notificationChannels) {
  try {
    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      UpdateExpression: 'SET notificationChannels = :notificationChannels, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':notificationChannels': notificationChannels,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating notification channels for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user locations
 * 
 * @param {string} userId - The ID of the user
 * @param {Array} locations - The locations to update
 * @returns {Promise<Object>} The updated user preferences
 */
async function updateUserLocations(userId, locations) {
  try {
    // Generate locationIds for any new locations
    const locationsWithIds = locations.map(location => {
      if (!location.locationId) {
        return {
          ...location,
          locationId: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        };
      }
      return location;
    });
    
    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      UpdateExpression: 'SET locations = :locations, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':locations': locationsWithIds,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating locations for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user accessibility preferences
 * 
 * @param {string} userId - The ID of the user
 * @param {Object} accessibilityPreferences - The accessibility preferences to update
 * @returns {Promise<Object>} The updated user preferences
 */
async function updateAccessibilityPreferences(userId, accessibilityPreferences) {
  try {
    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      UpdateExpression: 'SET profile.accessibilityPreferences = :accessibilityPreferences, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':accessibilityPreferences': accessibilityPreferences,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating accessibility preferences for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Subscribe user to alert categories
 * 
 * @param {string} userId - The ID of the user
 * @param {Array<string>} categories - The alert categories to subscribe to
 * @returns {Promise<Object>} The updated user preferences
 */
async function subscribeToCategories(userId, categories) {
  try {
    // First get the current user preferences
    const user = await getUserPreferences(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Get current categories or initialize empty array
    const currentCategories = user.alertPreferences?.categories || [];
    
    // Merge categories, removing duplicates
    const updatedCategories = [...new Set([...currentCategories, ...categories])];
    
    // Update the user's alert preferences
    const alertPreferences = {
      ...(user.alertPreferences || {}),
      categories: updatedCategories
    };
    
    return await updateAlertPreferences(userId, alertPreferences);
  } catch (error) {
    console.error(`Error subscribing user ${userId} to categories:`, error);
    throw error;
  }
}

/**
 * Unsubscribe user from alert categories
 * 
 * @param {string} userId - The ID of the user
 * @param {Array<string>} categories - The alert categories to unsubscribe from
 * @returns {Promise<Object>} The updated user preferences
 */
async function unsubscribeFromCategories(userId, categories) {
  try {
    // First get the current user preferences
    const user = await getUserPreferences(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Get current categories or initialize empty array
    const currentCategories = user.alertPreferences?.categories || [];
    
    // Remove specified categories
    const updatedCategories = currentCategories.filter(
      category => !categories.includes(category)
    );
    
    // Update the user's alert preferences
    const alertPreferences = {
      ...(user.alertPreferences || {}),
      categories: updatedCategories
    };
    
    return await updateAlertPreferences(userId, alertPreferences);
  } catch (error) {
    console.error(`Error unsubscribing user ${userId} from categories:`, error);
    throw error;
  }
}

module.exports = {
  getUserPreferences,
  updateAlertPreferences,
  updateNotificationChannels,
  updateUserLocations,
  updateAccessibilityPreferences,
  subscribeToCategories,
  unsubscribeFromCategories
};