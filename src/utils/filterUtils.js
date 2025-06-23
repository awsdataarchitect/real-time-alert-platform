/**
 * Utility functions for filtering and sorting alerts
 */

/**
 * Filter alerts based on multiple criteria
 * @param {Array} alerts - Array of alert objects
 * @param {Object} filters - Object containing filter criteria
 * @returns {Array} Filtered alerts
 */
export const filterAlerts = (alerts, filters = {}) => {
  if (!alerts || !Array.isArray(alerts)) {
    return [];
  }

  return alerts.filter(alert => {
    // Filter by category
    if (filters.category && alert.category !== filters.category) {
      return false;
    }

    // Filter by severity
    if (filters.severity && alert.severity !== filters.severity) {
      return false;
    }

    // Filter by status
    if (filters.status && alert.status !== filters.status) {
      return false;
    }

    // Filter by source type
    if (filters.sourceType && alert.sourceType !== filters.sourceType) {
      return false;
    }

    // Filter by event type
    if (filters.eventType && alert.eventType !== filters.eventType) {
      return false;
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      const alertDate = new Date(alert.startTime);
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      if (alertDate < startDate || alertDate > endDate) {
        return false;
      }
    } else if (filters.startDate) {
      const alertDate = new Date(alert.startTime);
      const startDate = new Date(filters.startDate);
      
      if (alertDate < startDate) {
        return false;
      }
    } else if (filters.endDate) {
      const alertDate = new Date(alert.startTime);
      const endDate = new Date(filters.endDate);
      
      if (alertDate > endDate) {
        return false;
      }
    }

    // Filter by search text (in headline or description)
    if (filters.searchText && filters.searchText.trim() !== '') {
      const searchText = filters.searchText.toLowerCase();
      const headline = (alert.headline || '').toLowerCase();
      const description = (alert.description || '').toLowerCase();
      
      if (!headline.includes(searchText) && !description.includes(searchText)) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Sort alerts based on specified field and direction
 * @param {Array} alerts - Array of alert objects
 * @param {String} sortField - Field to sort by
 * @param {String} sortDirection - Sort direction ('ASC' or 'DESC')
 * @returns {Array} Sorted alerts
 */
export const sortAlerts = (alerts, sortField = 'createdAt', sortDirection = 'DESC') => {
  if (!alerts || !Array.isArray(alerts)) {
    return [];
  }

  const sortedAlerts = [...alerts];
  
  sortedAlerts.sort((a, b) => {
    let valueA, valueB;
    
    // Handle nested fields like location.coordinates
    if (sortField.includes('.')) {
      const [parentField, childField] = sortField.split('.');
      valueA = a[parentField] ? a[parentField][childField] : null;
      valueB = b[parentField] ? b[parentField][childField] : null;
    } else {
      valueA = a[sortField];
      valueB = b[sortField];
    }
    
    // Handle date fields
    if (['createdAt', 'updatedAt', 'startTime', 'endTime'].includes(sortField)) {
      valueA = valueA ? new Date(valueA).getTime() : 0;
      valueB = valueB ? new Date(valueB).getTime() : 0;
    }
    
    // Handle numeric fields
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return sortDirection === 'ASC' ? valueA - valueB : valueB - valueA;
    }
    
    // Handle string fields
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortDirection === 'ASC' 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    }
    
    // Handle null/undefined values
    if (valueA === null || valueA === undefined) return sortDirection === 'ASC' ? -1 : 1;
    if (valueB === null || valueB === undefined) return sortDirection === 'ASC' ? 1 : -1;
    
    return 0;
  });
  
  return sortedAlerts;
};

/**
 * Paginate alerts
 * @param {Array} alerts - Array of alert objects
 * @param {Number} page - Page number (1-based)
 * @param {Number} pageSize - Number of items per page
 * @returns {Object} Object with paginated alerts and pagination info
 */
export const paginateAlerts = (alerts, page = 1, pageSize = 10) => {
  if (!alerts || !Array.isArray(alerts)) {
    return {
      alerts: [],
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
        pageSize: pageSize,
        hasNextPage: false,
        hasPreviousPage: false
      }
    };
  }

  const totalItems = alerts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  return {
    alerts: alerts.slice(startIndex, endIndex),
    pagination: {
      totalItems,
      totalPages,
      currentPage,
      pageSize,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    }
  };
};

/**
 * Get unique values for a specific field from alerts
 * @param {Array} alerts - Array of alert objects
 * @param {String} field - Field to get unique values for
 * @returns {Array} Array of unique values
 */
export const getUniqueValues = (alerts, field) => {
  if (!alerts || !Array.isArray(alerts) || !field) {
    return [];
  }

  const values = alerts.map(alert => alert[field]).filter(value => value !== null && value !== undefined);
  return [...new Set(values)];
};

/**
 * Create a filter input object for GraphQL queries
 * @param {Object} filters - Object containing filter criteria
 * @returns {Object} Filter input object for GraphQL
 */
export const createFilterInput = (filters = {}) => {
  const filterInput = {};
  
  if (filters.category) {
    filterInput.category = { eq: filters.category };
  }
  
  if (filters.severity) {
    filterInput.severity = { eq: filters.severity };
  }
  
  if (filters.status) {
    filterInput.status = { eq: filters.status };
  }
  
  if (filters.sourceType) {
    filterInput.sourceType = { eq: filters.sourceType };
  }
  
  if (filters.eventType) {
    filterInput.eventType = { eq: filters.eventType };
  }
  
  if (filters.startDate) {
    filterInput.startTimeFrom = filters.startDate;
  }
  
  if (filters.endDate) {
    filterInput.startTimeTo = filters.endDate;
  }
  
  return Object.keys(filterInput).length > 0 ? filterInput : null;
};