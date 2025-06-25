import React from 'react';
import { Link } from 'react-router-dom';
import './AlertDetail.css';

const AlertRelated = ({ alertId, eventType, subType }) => {
  // Mock related alerts
  const relatedAlerts = [
    {
      id: alertId === '1' ? '2' : '1', // Show the other alert as related
      title: alertId === '1' ? 'Traffic Incident' : 'Severe Weather Alert',
      severity: alertId === '1' ? 'MEDIUM' : 'HIGH',
      category: alertId === '1' ? 'TRAFFIC' : 'WEATHER',
      locationName: alertId === '1' ? 'Los Angeles' : 'San Francisco',
      locationState: 'CA',
      createdAt: new Date().toISOString()
    }
  ];

  const getSeverityClass = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
        return 'severity-low';
      default:
        return 'severity-unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="alert-detail-section alert-detail-related">
      <h3>Related Alerts</h3>
      {relatedAlerts.length === 0 ? (
        <p>No related alerts found.</p>
      ) : (
        <div className="related-alerts-list">
          {relatedAlerts.map((alert) => (
            <Link to={`/alert/${alert.id}`} key={alert.id} className="related-alert-card">
              <div className={`related-alert-severity ${getSeverityClass(alert.severity)}`}>
                {alert.severity}
              </div>
              <div className="related-alert-content">
                <h4>{alert.title}</h4>
                <div className="related-alert-meta">
                  <span>{alert.category}</span>
                  <span>{alert.locationName}, {alert.locationState}</span>
                  <span>{formatDate(alert.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertRelated;
