import React from 'react';
import './AlertSummary.css';

const AlertSummary = () => {
  // Mock data for demonstration
  const alertStats = {
    total: 12,
    critical: 3,
    high: 5,
    medium: 3,
    low: 1
  };

  const recentAlerts = [
    {
      id: '1',
      type: 'Weather',
      severity: 'critical',
      title: 'Severe Thunderstorm Warning',
      location: 'Downtown Area',
      time: '2 minutes ago'
    },
    {
      id: '2',
      type: 'Health',
      severity: 'high',
      title: 'Air Quality Alert',
      location: 'Industrial District',
      time: '15 minutes ago'
    },
    {
      id: '3',
      type: 'Traffic',
      severity: 'medium',
      title: 'Road Closure',
      location: 'Highway 101',
      time: '1 hour ago'
    }
  ];

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return icons[severity] || '⚪';
  };

  return (
    <div className="alert-summary" data-testid="alert-summary">
      <div className="summary-stats">
        <div className="stat-card total">
          <div className="stat-number">{alertStats.total}</div>
          <div className="stat-label">Total Alerts</div>
        </div>
        
        <div className="stat-grid">
          <div className="stat-item critical">
            <span className="stat-icon" aria-hidden="true">🔴</span>
            <span className="stat-count">{alertStats.critical}</span>
            <span className="stat-text">Critical</span>
          </div>
          
          <div className="stat-item high">
            <span className="stat-icon" aria-hidden="true">🟠</span>
            <span className="stat-count">{alertStats.high}</span>
            <span className="stat-text">High</span>
          </div>
          
          <div className="stat-item medium">
            <span className="stat-icon" aria-hidden="true">🟡</span>
            <span className="stat-count">{alertStats.medium}</span>
            <span className="stat-text">Medium</span>
          </div>
          
          <div className="stat-item low">
            <span className="stat-icon" aria-hidden="true">🟢</span>
            <span className="stat-count">{alertStats.low}</span>
            <span className="stat-text">Low</span>
          </div>
        </div>
      </div>

      <div className="recent-alerts">
        <h4>Recent Alerts</h4>
        <ul className="alert-list" role="list">
          {recentAlerts.map((alert) => (
            <li key={alert.id} className="alert-item" role="listitem">
              <div className="alert-content">
                <div className="alert-header">
                  <span 
                    className="alert-severity-icon" 
                    aria-label={`${alert.severity} severity`}
                  >
                    {getSeverityIcon(alert.severity)}
                  </span>
                  <span className="alert-type">{alert.type}</span>
                  <span className="alert-time">{alert.time}</span>
                </div>
                <div className="alert-title">{alert.title}</div>
                <div className="alert-location">{alert.location}</div>
              </div>
            </li>
          ))}
        </ul>
        
        <button className="view-all-btn" aria-label="View all alerts">
          View All Alerts
        </button>
      </div>
    </div>
  );
};

export default AlertSummary;