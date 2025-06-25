import React from 'react';
import Map from '../components/map/Map';
import './Dashboard.css'; // Reuse dashboard styles

const AlertMap = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Alert Map</h1>
        <p>Geographic visualization of all current alerts</p>
      </header>

      <div className="map-fullpage-container">
        <Map />
      </div>
    </div>
  );
};

export default AlertMap;
