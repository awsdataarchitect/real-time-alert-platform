import React, { useState, useEffect } from 'react';
import { useMap } from '../context/MapContext';
import './Dashboard.css'; // Reuse dashboard styles

const ActiveAlerts = () => {
  const { alerts, loading, error } = useMap();
  const [activeAlerts, setActiveAlerts] = useState([]);

  useEffect(() => {
    // Filter only active alerts
    if (alerts && alerts.length > 0) {
      const filtered = alerts.filter(alert => alert.isActive);
      setActiveAlerts(filtered);
    }
  }, [alerts]);

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

  if (loading) {
    return <div className="loading-container">Loading active alerts...</div>;
  }

  if (error) {
    return <div className="error-container">Error loading alerts: {error.message}</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Active Alerts</h1>
        <p>Currently active alerts requiring attention</p>
      </header>

      <div className="alerts-container">
        {activeAlerts.length === 0 ? (
          <div className="no-alerts">
            <p>No active alerts at this time.</p>
          </div>
        ) : (
          <div className="alert-list">
            {activeAlerts.map(alert => (
              <div key={alert.id} className={`alert-card ${getSeverityClass(alert.severity)}`}>
                <div className="alert-header">
                  <h3 className="alert-title">{alert.title}</h3>
                  <span className="alert-severity">{alert.severity}</span>
                </div>
                <div className="alert-body">
                  <p className="alert-description">{alert.description}</p>
                  <div className="alert-meta">
                    <span className="alert-location">{alert.locationName}, {alert.locationState}</span>
                    <span className="alert-category">{alert.category}</span>
                  </div>
                </div>
                <div className="alert-footer">
                  <span className="alert-source">Source: {alert.source}</span>
                  <a href={`/alert/${alert.id}`} className="alert-details-link">View Details</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveAlerts;
