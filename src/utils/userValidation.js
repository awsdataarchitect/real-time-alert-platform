/**
 * User data validation utilities
 * 
 * This module provides validation functions for User data model
 * to ensure data integrity and consistency.
 */

/**
 * Validates a user object against required fields and format constraints
 * @param {Object} user - The user object to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateUser = (user) => {
  const errors = [];
  
  // Check required fields
  if (!user) {
    return { isValid: false, errors: ['User object is required'] };
  }
  
  if (!user.username) {
    errors.push('Username is required');
  } else if (user.username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  // Validate email format if provided
  if (user.email && !isValidEmail(user.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate phone format if provided
  if (user.phone && !isValidPhone(user.phone)) {
    errors.push('Invalid phone format');
  }
  
  // Validate notification channels if provided
  if (user.notificationChannels && user.notificationChannels.length > 0) {
    user.notificationChannels.forEach((channel, index) => {
      if (!channel.channelType) {
        errors.push(`Notification channel at index ${index} is missing channelType`);
      }
      if (!channel.channelId) {
        errors.push(`Notification channel at index ${index} is missing channelId`);
      }
      if (channel.priority === undefined || channel.priority === null) {
        errors.push(`Notification channel at index ${index} is missing priority`);
      }
      if (channel.enabled === undefined || channel.enabled === null) {
        errors.push(`Notification channel at index ${index} is missing enabled flag`);
      }
    });
  }
  
  // Validate locations if provided
  if (user.locations && user.locations.length > 0) {
    user.locations.forEach((location, index) => {
      if (!location.name) {
        errors.push(`Location at index ${index} is missing name`);
      }
      if (!location.type) {
        errors.push(`Location at index ${index} is missing type`);
      }
      if (!location.coordinates) {
        errors.push(`Location at index ${index} is missing coordinates`);
      } else {
        if (location.coordinates.latitude === undefined || location.coordinates.latitude === null) {
          errors.push(`Location at index ${index} is missing latitude`);
        }
        if (location.coordinates.longitude === undefined || location.coordinates.longitude === null) {
          errors.push(`Location at index ${index} is missing longitude`);
        }
      }
    });
  }
  
  // Validate alert preferences if provided
  if (user.alertPreferences) {
    const alertPreferencesValidation = validateAlertPreferences(user.alertPreferences);
    if (!alertPreferencesValidation.isValid) {
      errors.push(...alertPreferencesValidation.errors);
    }
  }
  
  // Validate accessibility preferences if provided
  if (user.profile && user.profile.accessibilityPreferences) {
    const accessibilityValidation = validateAccessibilityPreferences(user.profile.accessibilityPreferences);
    if (!accessibilityValidation.isValid) {
      errors.push(...accessibilityValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if phone is valid
 */
export const isValidPhone = (phone) => {
  // Basic validation for international phone numbers
  // This is a simplified version and might need to be enhanced for production
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates alert preferences
 * @param {Object} preferences - Alert preferences to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateAlertPreferences = (preferences) => {
  const errors = [];
  
  if (!preferences) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  // Validate categories if provided
  if (preferences.categories) {
    if (!Array.isArray(preferences.categories)) {
      errors.push('Categories must be an array');
    } else {
      const validCategories = [
        'WEATHER', 'EARTHQUAKE', 'TSUNAMI', 'VOLCANO', 'FIRE', 
        'FLOOD', 'HEALTH', 'SECURITY', 'INFRASTRUCTURE', 'TRANSPORTATION', 'OTHER'
      ];
      
      preferences.categories.forEach((category, index) => {
        if (!validCategories.includes(category)) {
          errors.push(`Invalid category at index ${index}. Must be one of: ${validCategories.join(', ')}`);
        }
      });
    }
  }
  
  // Validate minimum severity if provided
  if (preferences.minSeverity) {
    const validSeverities = ['EXTREME', 'SEVERE', 'MODERATE', 'MINOR', 'UNKNOWN'];
    if (!validSeverities.includes(preferences.minSeverity)) {
      errors.push(`Invalid minSeverity. Must be one of: ${validSeverities.join(', ')}`);
    }
  }
  
  // Validate quiet hours if provided
  if (preferences.quietHours) {
    const { quietHours } = preferences;
    if (quietHours.enabled === undefined || quietHours.enabled === null) {
      errors.push('QuietHours is missing enabled flag');
    }
    if (quietHours.overrideForCritical === undefined || quietHours.overrideForCritical === null) {
      errors.push('QuietHours is missing overrideForCritical flag');
    }
    if (quietHours.enabled && (!quietHours.start || !quietHours.end)) {
      errors.push('QuietHours is enabled but missing start or end time');
    }
    
    // Validate time format if provided
    if (quietHours.start && !isValidTimeFormat(quietHours.start)) {
      errors.push('QuietHours start time has invalid format. Use HH:MM format (24-hour)');
    }
    if (quietHours.end && !isValidTimeFormat(quietHours.end)) {
      errors.push('QuietHours end time has invalid format. Use HH:MM format (24-hour)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates time format (HH:MM in 24-hour format)
 * @param {string} time - Time string to validate
 * @returns {boolean} - True if time format is valid
 */
export const isValidTimeFormat = (time) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

/**
 * Validates notification channels
 * @param {Array} channels - Notification channels to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateNotificationChannels = (channels) => {
  const errors = [];
  
  if (!channels) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  if (!Array.isArray(channels)) {
    return { isValid: false, errors: ['Notification channels must be an array'] };
  }
  
  const validChannelTypes = [
    'APP_NOTIFICATION', 'SMS', 'EMAIL', 'VOICE_CALL', 
    'SOCIAL_MEDIA', 'EMERGENCY_BROADCAST', 'MESH_NETWORK'
  ];
  
  channels.forEach((channel, index) => {
    if (!channel.channelType) {
      errors.push(`Notification channel at index ${index} is missing channelType`);
    } else if (!validChannelTypes.includes(channel.channelType)) {
      errors.push(`Invalid channelType at index ${index}. Must be one of: ${validChannelTypes.join(', ')}`);
    }
    
    if (!channel.channelId) {
      errors.push(`Notification channel at index ${index} is missing channelId`);
    }
    
    if (channel.priority === undefined || channel.priority === null) {
      errors.push(`Notification channel at index ${index} is missing priority`);
    } else if (!Number.isInteger(channel.priority) || channel.priority < 1 || channel.priority > 10) {
      errors.push(`Invalid priority at index ${index}. Must be an integer between 1 and 10`);
    }
    
    if (channel.enabled === undefined || channel.enabled === null) {
      errors.push(`Notification channel at index ${index} is missing enabled flag`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates user locations
 * @param {Array} locations - User locations to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateUserLocations = (locations) => {
  const errors = [];
  
  if (!locations) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  if (!Array.isArray(locations)) {
    return { isValid: false, errors: ['Locations must be an array'] };
  }
  
  const validLocationTypes = ['HOME', 'WORK', 'SCHOOL', 'FAMILY', 'TRAVEL', 'OTHER'];
  
  locations.forEach((location, index) => {
    if (!location.name) {
      errors.push(`Location at index ${index} is missing name`);
    }
    
    if (!location.type) {
      errors.push(`Location at index ${index} is missing type`);
    } else if (!validLocationTypes.includes(location.type)) {
      errors.push(`Invalid location type at index ${index}. Must be one of: ${validLocationTypes.join(', ')}`);
    }
    
    if (!location.coordinates) {
      errors.push(`Location at index ${index} is missing coordinates`);
    } else {
      if (location.coordinates.latitude === undefined || location.coordinates.latitude === null) {
        errors.push(`Location at index ${index} is missing latitude`);
      } else if (isNaN(location.coordinates.latitude) || 
                location.coordinates.latitude < -90 || 
                location.coordinates.latitude > 90) {
        errors.push(`Invalid latitude at index ${index}. Must be between -90 and 90`);
      }
      
      if (location.coordinates.longitude === undefined || location.coordinates.longitude === null) {
        errors.push(`Location at index ${index} is missing longitude`);
      } else if (isNaN(location.coordinates.longitude) || 
                location.coordinates.longitude < -180 || 
                location.coordinates.longitude > 180) {
        errors.push(`Invalid longitude at index ${index}. Must be between -180 and 180`);
      }
    }
    
    if (location.radius !== undefined && location.radius !== null) {
      if (isNaN(location.radius) || location.radius <= 0) {
        errors.push(`Invalid radius at index ${index}. Must be a positive number`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates accessibility preferences
 * @param {Object} preferences - Accessibility preferences to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateAccessibilityPreferences = (preferences) => {
  const errors = [];
  
  if (!preferences) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  const validFormats = ['standard', 'large-text', 'high-contrast', 'screen-reader'];
  if (preferences.preferredFormat && !validFormats.includes(preferences.preferredFormat)) {
    errors.push(`Invalid preferredFormat. Must be one of: ${validFormats.join(', ')}`);
  }
  
  const validTextSizes = ['small', 'medium', 'large', 'x-large'];
  if (preferences.textSize && !validTextSizes.includes(preferences.textSize)) {
    errors.push(`Invalid textSize. Must be one of: ${validTextSizes.join(', ')}`);
  }
  
  const validColorSchemes = ['default', 'high-contrast', 'dark', 'light'];
  if (preferences.colorScheme && !validColorSchemes.includes(preferences.colorScheme)) {
    errors.push(`Invalid colorScheme. Must be one of: ${validColorSchemes.join(', ')}`);
  }
  
  if (preferences.audioEnabled !== undefined && typeof preferences.audioEnabled !== 'boolean') {
    errors.push('audioEnabled must be a boolean value');
  }
  
  if (preferences.additionalNeeds && !Array.isArray(preferences.additionalNeeds)) {
    errors.push('additionalNeeds must be an array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates device token
 * @param {Object} token - Device token to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export const validateDeviceToken = (token) => {
  const errors = [];
  
  if (!token) {
    return { isValid: false, errors: ['Device token is required'] };
  }
  
  if (!token.deviceId) {
    errors.push('Device ID is required');
  }
  
  if (!token.platform) {
    errors.push('Platform is required');
  } else {
    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(token.platform.toLowerCase())) {
      errors.push(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
    }
  }
  
  if (!token.token) {
    errors.push('Token value is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};