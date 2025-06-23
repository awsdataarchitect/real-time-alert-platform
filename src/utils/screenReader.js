/**
 * Screen reader compatibility utilities
 */

/**
 * Live region manager for dynamic content announcements
 */
export class LiveRegionManager {
  constructor() {
    this.regions = new Map();
    this.init();
  }
  
  init() {
    // Create default live regions
    this.createRegion('polite', 'polite');
    this.createRegion('assertive', 'assertive');
    this.createRegion('status', 'polite', 'status');
  }
  
  createRegion(id, priority = 'polite', role = null) {
    if (this.regions.has(id)) {
      return this.regions.get(id);
    }
    
    const region = document.createElement('div');
    region.id = `live-region-${id}`;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    
    if (role) {
      region.setAttribute('role', role);
    }
    
    document.body.appendChild(region);
    this.regions.set(id, region);
    
    return region;
  }
  
  announce(message, priority = 'polite', clear = true) {
    const region = this.regions.get(priority) || this.regions.get('polite');
    
    if (clear) {
      region.textContent = '';
      // Force reflow to ensure screen reader picks up the change
      region.offsetHeight;
    }
    
    region.textContent = message;
  }
  
  announceStatus(message) {
    this.announce(message, 'status');
  }
  
  announceAlert(message) {
    this.announce(message, 'assertive');
  }
  
  clear(priority = 'polite') {
    const region = this.regions.get(priority);
    if (region) {
      region.textContent = '';
    }
  }
  
  clearAll() {
    this.regions.forEach(region => {
      region.textContent = '';
    });
  }
}

/**
 * ARIA label and description utilities
 */
export const ariaUtils = {
  /**
   * Generate a unique ID for ARIA relationships
   */
  generateId: (prefix = 'aria') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },
  
  /**
   * Set up ARIA labelledby relationship
   */
  labelledBy: (element, labelElement) => {
    if (!labelElement.id) {
      labelElement.id = ariaUtils.generateId('label');
    }
    element.setAttribute('aria-labelledby', labelElement.id);
  },
  
  /**
   * Set up ARIA describedby relationship
   */
  describedBy: (element, descriptionElement) => {
    if (!descriptionElement.id) {
      descriptionElement.id = ariaUtils.generateId('desc');
    }
    
    const existingDescribedBy = element.getAttribute('aria-describedby');
    const newDescribedBy = existingDescribedBy 
      ? `${existingDescribedBy} ${descriptionElement.id}`
      : descriptionElement.id;
    
    element.setAttribute('aria-describedby', newDescribedBy);
  },
  
  /**
   * Create accessible name for an element
   */
  createAccessibleName: (element, options = {}) => {
    const { 
      label, 
      labelledBy, 
      describedBy, 
      role,
      expanded,
      pressed,
      selected,
      checked
    } = options;
    
    if (label) {
      element.setAttribute('aria-label', label);
    }
    
    if (labelledBy) {
      element.setAttribute('aria-labelledby', labelledBy);
    }
    
    if (describedBy) {
      element.setAttribute('aria-describedby', describedBy);
    }
    
    if (role) {
      element.setAttribute('role', role);
    }
    
    if (typeof expanded === 'boolean') {
      element.setAttribute('aria-expanded', expanded.toString());
    }
    
    if (typeof pressed === 'boolean') {
      element.setAttribute('aria-pressed', pressed.toString());
    }
    
    if (typeof selected === 'boolean') {
      element.setAttribute('aria-selected', selected.toString());
    }
    
    if (typeof checked === 'boolean') {
      element.setAttribute('aria-checked', checked.toString());
    }
  }
};

/**
 * Alert severity to accessible text conversion
 */
export const getAccessibleSeverityText = (severity) => {
  const severityMap = {
    critical: 'Critical alert requiring immediate attention',
    high: 'High priority alert',
    medium: 'Medium priority alert',
    low: 'Low priority alert',
    info: 'Informational alert'
  };
  
  return severityMap[severity] || `${severity} priority alert`;
};

/**
 * Format alert for screen reader announcement
 */
export const formatAlertForScreenReader = (alert) => {
  const parts = [];
  
  // Severity
  parts.push(getAccessibleSeverityText(alert.severity));
  
  // Category
  if (alert.category) {
    parts.push(`Category: ${alert.category}`);
  }
  
  // Headline
  if (alert.headline) {
    parts.push(`Alert: ${alert.headline}`);
  }
  
  // Location
  if (alert.location && alert.affectedAreas && alert.affectedAreas.length > 0) {
    const areas = alert.affectedAreas.map(area => area.areaName).join(', ');
    parts.push(`Affected areas: ${areas}`);
  }
  
  // Time
  if (alert.startTime) {
    const startTime = new Date(alert.startTime).toLocaleString();
    parts.push(`Start time: ${startTime}`);
  }
  
  return parts.join('. ') + '.';
};

/**
 * Progress announcement utilities
 */
export const progressUtils = {
  announceProgress: (current, total, label = 'Progress') => {
    const percentage = Math.round((current / total) * 100);
    const message = `${label}: ${current} of ${total}, ${percentage} percent complete`;
    liveRegionManager.announceStatus(message);
  },
  
  announceCompletion: (label = 'Task') => {
    const message = `${label} completed successfully`;
    liveRegionManager.announceStatus(message);
  },
  
  announceError: (error, context = '') => {
    const message = context 
      ? `Error in ${context}: ${error}`
      : `Error: ${error}`;
    liveRegionManager.announceAlert(message);
  }
};

/**
 * Form validation announcements
 */
export const formUtils = {
  announceValidationError: (fieldName, error) => {
    const message = `${fieldName}: ${error}`;
    liveRegionManager.announceAlert(message);
  },
  
  announceValidationSuccess: (fieldName) => {
    const message = `${fieldName} is valid`;
    liveRegionManager.announceStatus(message);
  },
  
  announceFormSubmission: (isLoading = false) => {
    const message = isLoading 
      ? 'Form is being submitted, please wait'
      : 'Form submitted successfully';
    liveRegionManager.announceStatus(message);
  }
};

/**
 * Navigation announcements
 */
export const navigationUtils = {
  announcePageChange: (pageName) => {
    const message = `Navigated to ${pageName}`;
    liveRegionManager.announceStatus(message);
  },
  
  announceModalOpen: (modalTitle) => {
    const message = `${modalTitle} dialog opened`;
    liveRegionManager.announceStatus(message);
  },
  
  announceModalClose: () => {
    const message = 'Dialog closed';
    liveRegionManager.announceStatus(message);
  },
  
  announceMenuOpen: (menuName) => {
    const message = `${menuName} menu opened`;
    liveRegionManager.announceStatus(message);
  },
  
  announceMenuClose: () => {
    const message = 'Menu closed';
    liveRegionManager.announceStatus(message);
  }
};

/**
 * Data loading announcements
 */
export const loadingUtils = {
  announceLoadingStart: (content = 'content') => {
    const message = `Loading ${content}, please wait`;
    liveRegionManager.announceStatus(message);
  },
  
  announceLoadingComplete: (content = 'content') => {
    const message = `${content} loaded successfully`;
    liveRegionManager.announceStatus(message);
  },
  
  announceLoadingError: (content = 'content', error = '') => {
    const message = error 
      ? `Failed to load ${content}: ${error}`
      : `Failed to load ${content}`;
    liveRegionManager.announceAlert(message);
  },
  
  announceDataUpdate: (itemCount, itemType = 'items') => {
    const message = `${itemCount} ${itemType} updated`;
    liveRegionManager.announceStatus(message);
  }
};

/**
 * Table and list announcements
 */
export const tableUtils = {
  announceTableSort: (column, direction) => {
    const message = `Table sorted by ${column}, ${direction}`;
    liveRegionManager.announceStatus(message);
  },
  
  announceTableFilter: (filterCount, totalCount) => {
    const message = `Showing ${filterCount} of ${totalCount} items`;
    liveRegionManager.announceStatus(message);
  },
  
  announceSelection: (selectedCount, totalCount, itemType = 'items') => {
    const message = `${selectedCount} of ${totalCount} ${itemType} selected`;
    liveRegionManager.announceStatus(message);
  }
};

/**
 * Create and manage the global live region manager
 */
export const liveRegionManager = new LiveRegionManager();

/**
 * Utility to check if screen reader is likely active
 */
export const isScreenReaderActive = () => {
  // This is a heuristic and not 100% reliable
  return window.navigator.userAgent.includes('NVDA') ||
         window.navigator.userAgent.includes('JAWS') ||
         window.speechSynthesis?.speaking ||
         document.querySelector('[aria-live]') !== null;
};

/**
 * Enhanced focus announcements for screen readers
 */
export const focusUtils = {
  announceFocus: (element) => {
    const label = element.getAttribute('aria-label') ||
                 element.getAttribute('title') ||
                 element.textContent?.trim() ||
                 element.tagName.toLowerCase();
    
    const role = element.getAttribute('role') || element.tagName.toLowerCase();
    const message = `Focused on ${role}: ${label}`;
    
    liveRegionManager.announceStatus(message);
  },
  
  announceExpanded: (element, isExpanded) => {
    const label = element.getAttribute('aria-label') || element.textContent?.trim();
    const state = isExpanded ? 'expanded' : 'collapsed';
    const message = `${label} ${state}`;
    
    liveRegionManager.announceStatus(message);
  }
};