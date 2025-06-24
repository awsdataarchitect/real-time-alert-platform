import React from 'react';
import Map from '../components/map/Map';
import TestMapContext from '../components/TestMapContext';
import AlertSummary from '../components/dashboard/AlertSummary';
import QuickActions from '../components/dashboard/QuickActions';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard" data-testid="dashboard">
      <div className="dashboard-header">
        <h2>Emergency Alert Dashboard</h2>
        <p className="dashboard-subtitle">
          Real-time monitoring of critical events and alerts
        </p>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section map-section" aria-labelledby="map-heading">
          <h3 id="map-heading" className="section-title">Alert Map</h3>
          <div className="map-container">
            <TestMapContext />
            <Map />
          </div>
        </section>

        <section className="dashboard-section summary-section" aria-labelledby="summary-heading">
          <h3 id="summary-heading" className="section-title">Alert Summary</h3>
          <AlertSummary />
        </section>

        <section className="dashboard-section actions-section" aria-labelledby="actions-heading">
          <h3 id="actions-heading" className="section-title">Quick Actions</h3>
          <QuickActions />
        </section>
      </div>
    </div>
  );
};

export default Dashboard;