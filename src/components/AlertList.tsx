import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export default function AlertList() {
  const [alerts, setAlerts] = useState<Array<Schema["Alert"]["type"]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const { data } = await client.models.Alert.list();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      const { data } = await client.models.Alert.create({
        title: 'Test Alert',
        description: 'This is a test alert',
        severity: 'MEDIUM',
        category: 'WEATHER',
        locationName: 'Test Location',
        locationCountry: 'US',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'Manual',
        sourceId: 'test-001',
        eventType: 'TEST',
        startTime: new Date().toISOString(),
        isActive: true,
      });
      
      if (data) {
        setAlerts([...alerts, data]);
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  if (loading) {
    return <div>Loading alerts...</div>;
  }

  return (
    <div className="alert-list">
      <div className="alert-header">
        <h2>Real-Time Alerts</h2>
        <button onClick={createAlert} className="create-btn">
          Create Test Alert
        </button>
      </div>
      
      {alerts.length === 0 ? (
        <p>No alerts found.</p>
      ) : (
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-card">
              <h3>{alert.title}</h3>
              <p>{alert.description}</p>
              <div className="alert-meta">
                <span className={`severity ${alert.severity?.toLowerCase()}`}>
                  {alert.severity}
                </span>
                <span className="category">{alert.category}</span>
              </div>
              <div className="alert-time">
                {new Date(alert.startTime).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}