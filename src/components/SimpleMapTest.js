import React from 'react';
import { useSimpleMap } from '../context/SimpleMapContext';

const SimpleMapTest = () => {
  try {
    const { alerts, loading } = useSimpleMap();
    return (
      <div>
        <h3>Simple Map Context Test</h3>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Alerts count: {alerts.length}</p>
        <p>✅ Context is working!</p>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <h3>Simple Map Context Test - ERROR</h3>
        <p>❌ Error: {error.message}</p>
      </div>
    );
  }
};

export default SimpleMapTest;