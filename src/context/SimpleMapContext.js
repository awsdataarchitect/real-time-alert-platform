import React, { createContext, useContext, useState } from 'react';

const SimpleMapContext = createContext();

export const SimpleMapProvider = ({ children }) => {
  console.log('SimpleMapProvider rendering...');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const value = {
    alerts,
    setAlerts,
    loading,
    setLoading
  };

  return (
    <SimpleMapContext.Provider value={value}>
      {children}
    </SimpleMapContext.Provider>
  );
};

export const useSimpleMap = () => {
  console.log('useSimpleMap called...');
  const context = useContext(SimpleMapContext);
  console.log('SimpleMapContext value:', context);
  if (context === undefined) {
    console.error('SimpleMapContext is undefined!');
    throw new Error('useSimpleMap must be used within a SimpleMapProvider');
  }
  return context;
};