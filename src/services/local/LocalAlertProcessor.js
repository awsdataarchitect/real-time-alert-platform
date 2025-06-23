/**
 * Local Alert Processor
 * Handles alert processing on edge devices with limited connectivity
 */

class LocalAlertProcessor {
  constructor() {
    this.alertQueue = [];
    this.processingRules = this.initializeProcessingRules();
    this.notificationService = null;
  }

  /**
   * Initialize simplified alert classification rules
   */
  initializeProcessingRules() {
    return {
      severity: {
        critical: ['earthquake', 'tsunami', 'tornado', 'fire', 'flood', 'chemical'],
        high: ['severe_weather', 'health_emergency', 'security_threat'],
        medium: ['weather_warning', 'traffic_alert', 'air_quality'],
        low: ['general_info', 'maintenance', 'advisory']
      },
      keywords: {
        earthquake: ['earthquake', 'seismic', 'tremor', 'magnitude'],
        fire: ['fire', 'wildfire', 'smoke', 'evacuation'],
        weather: ['storm', 'hurricane', 'tornado', 'flood', 'snow', 'ice'],
        health: ['outbreak', 'disease', 'contamination', 'medical'],
        security: ['threat', 'attack', 'suspicious', 'lockdown']
      },
      geospatial: {
        proximityThreshold: 50000, // 50km in meters
        urgencyRadius: 10000 // 10km for urgent alerts
      }
    };
  }

  /**
   * Set notification service for local notifications
   */
  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Process incoming alert locally
   */
  async processAlert(rawAlert) {
    try {
      // Validate alert data
      if (!this.validateAlert(rawAlert)) {
        throw new Error('Invalid alert data');
      }

      // Classify alert
      const classifiedAlert = this.classifyAlert(rawAlert);

      // Enrich with local context
      const enrichedAlert = await this.enrichAlert(classifiedAlert);

      // Determine if notification should be sent
      if (this.shouldNotify(enrichedAlert)) {
        await this.generateLocalNotification(enrichedAlert);
      }

      // Store in local queue for sync
      this.alertQueue.push(enrichedAlert);

      return enrichedAlert;
    } catch (error) {
      console.error('Error processing alert locally:', error);
      throw error;
    }
  }

  /**
   * Validate alert data structure
   */
  validateAlert(alert) {
    const requiredFields = ['id', 'type', 'description', 'timestamp'];
    return requiredFields.every(field => alert && alert[field] !== undefined);
  }

  /**
   * Simplified alert classification using keyword matching
   */
  classifyAlert(alert) {
    const description = (alert.description || '').toLowerCase();
    const title = (alert.title || '').toLowerCase();
    const content = `${title} ${description}`;

    let alertType = 'general';
    let severity = 'low';

    // Classify by keywords
    for (const [type, keywords] of Object.entries(this.processingRules.keywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        alertType = type;
        break;
      }
    }

    // Determine severity
    for (const [level, types] of Object.entries(this.processingRules.severity)) {
      if (types.includes(alertType) || types.some(type => content.includes(type))) {
        severity = level;
        break;
      }
    }

    return {
      ...alert,
      classifiedType: alertType,
      severity: severity,
      confidence: this.calculateConfidence(content, alertType),
      processedAt: new Date().toISOString(),
      processedLocally: true
    };
  }

  /**
   * Calculate classification confidence score
   */
  calculateConfidence(content, alertType) {
    const keywords = this.processingRules.keywords[alertType] || [];
    const matches = keywords.filter(keyword => content.includes(keyword)).length;
    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Enrich alert with local context
   */
  async enrichAlert(alert) {
    try {
      // Add local timestamp
      const enriched = {
        ...alert,
        localTimestamp: new Date().toISOString(),
        deviceId: this.getDeviceId()
      };

      // Add geospatial context if location available
      if (alert.location && navigator.geolocation) {
        const userLocation = await this.getCurrentLocation();
        if (userLocation) {
          enriched.distanceFromUser = this.calculateDistance(
            alert.location,
            userLocation
          );
          enriched.isNearby = enriched.distanceFromUser < this.processingRules.geospatial.proximityThreshold;
        }
      }

      return enriched;
    } catch (error) {
      console.warn('Error enriching alert:', error);
      return alert;
    }
  }

  /**
   * Get current device location
   */
  getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null),
        { timeout: 5000, maximumAge: 300000 } // 5 min cache
      );
    });
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = point1.latitude * Math.PI / 180;
    const lat2Rad = point2.latitude * Math.PI / 180;
    const deltaLatRad = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLonRad = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Determine if alert should trigger notification
   */
  shouldNotify(alert) {
    // Always notify for critical alerts
    if (alert.severity === 'critical') {
      return true;
    }

    // Notify for high severity if nearby
    if (alert.severity === 'high' && alert.isNearby) {
      return true;
    }

    // Notify for urgent alerts within close proximity
    if (alert.distanceFromUser && 
        alert.distanceFromUser < this.processingRules.geospatial.urgencyRadius) {
      return true;
    }

    return false;
  }

  /**
   * Generate local notification
   */
  async generateLocalNotification(alert) {
    if (!this.notificationService) {
      console.warn('No notification service configured');
      return;
    }

    const notification = {
      title: this.generateNotificationTitle(alert),
      body: this.generateNotificationBody(alert),
      icon: this.getNotificationIcon(alert.severity),
      badge: this.getNotificationBadge(alert.classifiedType),
      tag: alert.id,
      data: {
        alertId: alert.id,
        severity: alert.severity,
        type: alert.classifiedType
      },
      requireInteraction: alert.severity === 'critical',
      silent: false
    };

    try {
      await this.notificationService.show(notification);
      console.log('Local notification sent for alert:', alert.id);
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  /**
   * Generate notification title
   */
  generateNotificationTitle(alert) {
    const severityPrefix = {
      critical: '🚨 CRITICAL ALERT',
      high: '⚠️ HIGH PRIORITY',
      medium: '📢 ALERT',
      low: 'ℹ️ INFO'
    };

    return `${severityPrefix[alert.severity] || 'ALERT'}: ${alert.classifiedType.toUpperCase()}`;
  }

  /**
   * Generate notification body
   */
  generateNotificationBody(alert) {
    let body = alert.description || 'No description available';
    
    if (alert.distanceFromUser) {
      const distance = Math.round(alert.distanceFromUser / 1000);
      body += `\n📍 ${distance}km from your location`;
    }

    if (alert.confidence < 0.8) {
      body += '\n⚠️ Automated classification - verify details';
    }

    return body;
  }

  /**
   * Get notification icon based on severity
   */
  getNotificationIcon(severity) {
    const icons = {
      critical: '/icons/alert-critical.png',
      high: '/icons/alert-high.png',
      medium: '/icons/alert-medium.png',
      low: '/icons/alert-low.png'
    };
    return icons[severity] || '/icons/alert-default.png';
  }

  /**
   * Get notification badge based on alert type
   */
  getNotificationBadge(type) {
    const badges = {
      earthquake: '/badges/earthquake.png',
      fire: '/badges/fire.png',
      weather: '/badges/weather.png',
      health: '/badges/health.png',
      security: '/badges/security.png'
    };
    return badges[type] || '/badges/default.png';
  }

  /**
   * Get device identifier
   */
  getDeviceId() {
    // Use stored device ID or generate one
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Get queued alerts for synchronization
   */
  getQueuedAlerts() {
    return [...this.alertQueue];
  }

  /**
   * Clear processed alerts from queue
   */
  clearQueue() {
    this.alertQueue = [];
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      queueSize: this.alertQueue.length,
      lastProcessed: this.alertQueue.length > 0 ? 
        this.alertQueue[this.alertQueue.length - 1].processedAt : null,
      rulesVersion: '1.0.0'
    };
  }
}

export default LocalAlertProcessor;