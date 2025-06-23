/**
 * Lambda function for user preference management
 * 
 * This function handles user preference management operations including
 * updating alert preferences, notification channels, locations, and
 * accessibility preferences.
 */

import { 
  validateAlertPreferences, 
  validateNotificationChannels, 
  validateUserLocations, 
  validateAccessibilityPreferences 
} from '../utils/userValidation';

import {
  getUserPreferences,
  updateAlertPreferences,
  updateNotificationChannels,
  updateUserLocations,
  updateAccessibilityPreferences,
  subscribeToCategories,
  unsubscribeFromCategories
} from '../services/database/userPreferenceQueries';

/**
 * Update user alert preferences
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const updateUserAlertPreferences = async (event, context) => {
  try {
    const { userId, alertPreferences } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!alertPreferences) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Alert preferences are required'
        })
      };
    }
    
    // Validate alert preferences
    const validation = validateAlertPreferences(alertPreferences);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid alert preferences',
          errors: validation.errors
        })
      };
    }
    
    // Update alert preferences in the database
    const updatedUser = await updateAlertPreferences(userId, alertPreferences);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Alert preferences updated successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error updating alert preferences:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating alert preferences',
        error: error.message
      })
    };
  }
};

/**
 * Update user notification channels
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const updateUserNotificationChannels = async (event, context) => {
  try {
    const { userId, notificationChannels } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!notificationChannels) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Notification channels are required'
        })
      };
    }
    
    // Validate notification channels
    const validation = validateNotificationChannels(notificationChannels);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid notification channels',
          errors: validation.errors
        })
      };
    }
    
    // Update notification channels in the database
    const updatedUser = await updateNotificationChannels(userId, notificationChannels);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Notification channels updated successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error updating notification channels:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating notification channels',
        error: error.message
      })
    };
  }
};

/**
 * Update user locations
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const updateUserLocationsHandler = async (event, context) => {
  try {
    const { userId, locations } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!locations) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Locations are required'
        })
      };
    }
    
    // Validate locations
    const validation = validateUserLocations(locations);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid locations',
          errors: validation.errors
        })
      };
    }
    
    // Update locations in the database
    const updatedUser = await updateUserLocations(userId, locations);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Locations updated successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error updating locations:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating locations',
        error: error.message
      })
    };
  }
};

/**
 * Update user accessibility preferences
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const updateUserAccessibilityPreferences = async (event, context) => {
  try {
    const { userId, accessibilityPreferences } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!accessibilityPreferences) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Accessibility preferences are required'
        })
      };
    }
    
    // Validate accessibility preferences
    const validation = validateAccessibilityPreferences(accessibilityPreferences);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid accessibility preferences',
          errors: validation.errors
        })
      };
    }
    
    // Update accessibility preferences in the database
    const updatedUser = await updateAccessibilityPreferences(userId, accessibilityPreferences);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Accessibility preferences updated successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error updating accessibility preferences:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating accessibility preferences',
        error: error.message
      })
    };
  }
};

/**
 * Subscribe user to alert categories
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const subscribeUserToCategories = async (event, context) => {
  try {
    const { userId, categories } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Categories array is required and must not be empty'
        })
      };
    }
    
    // Validate categories
    const validCategories = [
      'WEATHER', 'EARTHQUAKE', 'TSUNAMI', 'VOLCANO', 'FIRE', 
      'FLOOD', 'HEALTH', 'SECURITY', 'INFRASTRUCTURE', 'TRANSPORTATION', 'OTHER'
    ];
    
    const invalidCategories = categories.filter(category => !validCategories.includes(category));
    if (invalidCategories.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid categories',
          invalidCategories,
          validCategories
        })
      };
    }
    
    // Subscribe user to categories
    const updatedUser = await subscribeToCategories(userId, categories);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User subscribed to categories successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error subscribing user to categories:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error subscribing user to categories',
        error: error.message
      })
    };
  }
};

/**
 * Unsubscribe user from alert categories
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const unsubscribeUserFromCategories = async (event, context) => {
  try {
    const { userId, categories } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Categories array is required and must not be empty'
        })
      };
    }
    
    // Validate categories
    const validCategories = [
      'WEATHER', 'EARTHQUAKE', 'TSUNAMI', 'VOLCANO', 'FIRE', 
      'FLOOD', 'HEALTH', 'SECURITY', 'INFRASTRUCTURE', 'TRANSPORTATION', 'OTHER'
    ];
    
    const invalidCategories = categories.filter(category => !validCategories.includes(category));
    if (invalidCategories.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid categories',
          invalidCategories,
          validCategories
        })
      };
    }
    
    // Unsubscribe user from categories
    const updatedUser = await unsubscribeFromCategories(userId, categories);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User unsubscribed from categories successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Error unsubscribing user from categories:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error unsubscribing user from categories',
        error: error.message
      })
    };
  }
};

/**
 * Get user preferences
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const getUserPreferencesHandler = async (event, context) => {
  try {
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User ID is required'
        })
      };
    }
    
    // Get user preferences from the database
    const userPreferences = await getUserPreferences(userId);
    
    if (!userPreferences) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `User with ID ${userId} not found`
        })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User preferences retrieved successfully',
        userPreferences
      })
    };
  } catch (error) {
    console.error('Error retrieving user preferences:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error retrieving user preferences',
        error: error.message
      })
    };
  }
};

/**
 * Main handler function that routes to the appropriate handler based on the path
 * 
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response object
 */
export const handler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;
  
  // Route to the appropriate handler based on the path and method
  if (path.endsWith('/preferences') && method === 'GET') {
    return await getUserPreferencesHandler(event, context);
  } else if (path.endsWith('/alert-preferences') && method === 'PUT') {
    return await updateUserAlertPreferences(event, context);
  } else if (path.endsWith('/notification-channels') && method === 'PUT') {
    return await updateUserNotificationChannels(event, context);
  } else if (path.endsWith('/locations') && method === 'PUT') {
    return await updateUserLocationsHandler(event, context);
  } else if (path.endsWith('/accessibility-preferences') && method === 'PUT') {
    return await updateUserAccessibilityPreferences(event, context);
  } else if (path.endsWith('/subscribe') && method === 'POST') {
    return await subscribeUserToCategories(event, context);
  } else if (path.endsWith('/unsubscribe') && method === 'POST') {
    return await unsubscribeUserFromCategories(event, context);
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'Not found'
      })
    };
  }
};

export default handler;