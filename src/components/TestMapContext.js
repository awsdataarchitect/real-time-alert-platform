import React from 'react';
import { useMap } from '../context/MapContext';

const TestMapContext = () => {
  try {
    const { alerts, loading } = useMap();
    return (
      <div>
        <h3>Map Context Test</h3>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Alerts count: {alerts.length}</p>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <h3>Map Context Test - ERROR</h3>
        <p>Error: {error.message}</p>
      </div>
    );
  }
};

export default TestMapContext;