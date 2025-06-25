import React, { useState, useEffect } from 'react';
import { useMap } from '../context/MapContext';
import './Dashboard.css'; // Reuse dashboard styles

const AlertHistory = () => {
  const { alerts, loading, error } = useMap();
  const [historicalAlerts, setHistoricalAlerts] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // For demo purposes, we'll consider some alerts as historical
    if (alerts && alerts.length > 0) {
      // Create a mix of active and resolved alerts for demonstration
      const historical = [...alerts].map((alert, index) => ({
        ...alert,
        isActive: index % 3 !== 0, // Make every third alert inactive/historical
        resolvedAt: index % 3 === 0 ? new Date(Date.now() - (index * 3600000)).toISOString() : null,
        status: index % 3 === 0 ? 'RESOLVED' : 'ACTIVE'
      }));
      
      setHistoricalAlerts(historical);
    }
  }, [alerts]);

  const filteredAlerts = filter === 'all' 
    ? historicalAlerts 
    : historicalAlerts.filter(alert => alert.status === filter);

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };

  if (loading) {
    return <div className="loading-container">Loading alert history...</div>;
  }

  if (error) {
    return <div className="error-container">Error loading alerts: {error.message}</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Alert History</h1>
        <p>Historical record of all past alerts</p>
      </header>

      <div className="filter-controls">
        <label htmlFor="status-filter">Filter by status:</label>
        <select 
          id="status-filter" 
          value={filter} 
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="all">All Alerts</option>
          <option value="ACTIVE">Active</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      <div className="alerts-container">
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <p>No alerts found matching your criteria.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
                <th>Resolved</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => (
                <tr key={alert.id} className={alert.status === 'RESOLVED' ? 'resolved-alert' : ''}>
                  <td>{alert.id}</td>
                  <td>{alert.title}</td>
                  <td>{alert.category}</td>
                  <td className={`severity ${alert.severity?.toLowerCase()}`}>{alert.severity}</td>
                  <td>{alert.locationName}, {alert.locationState}</td>
                  <td className={`status ${alert.status?.toLowerCase()}`}>{alert.status}</td>
                  <td>{new Date(alert.startTime).toLocaleString()}</td>
                  <td>{alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : 'N/A'}</td>
                  <td>
                    <a href={`/alert/${alert.id}`} className="view-details-btn">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
