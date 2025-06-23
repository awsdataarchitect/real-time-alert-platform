import React from 'react';
import { useMap } from '../../context/MapContext';

const AlertPopup = ({ alert }) => {
  const { getAlertSeverityColor } = useMap();
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const severityColor = getAlertSeverityColor(alert.severity);
  
  return (
    <div className="alert-popup" style={{ maxWidth: '300px' }}>
      <div 
        className="alert-popup-header"
        style={{ 
          backgroundColor: severityColor,
          color: '#fff',
          padding: '8px',
          borderTopLeftRadius: '4px',
          borderTopRightRadius: '4px',
          fontWeight: 'bold'
        }}
      >
        {alert.headline}
      </div>
      
      <div className="alert-popup-content" style={{ padding: '8px' }}>
        <div className="alert-popup-details">
          <p><strong>Category:</strong> {alert.category}</p>
          <p><strong>Severity:</strong> {alert.severity}</p>
          <p><strong>Start Time:</strong> {formatDate(alert.startTime)}</p>
          {alert.endTime && (
            <p><strong>End Time:</strong> {formatDate(alert.endTime)}</p>
          )}
        </div>
        
        <div className="alert-popup-description" style={{ marginTop: '8px' }}>
          <p>{alert.description}</p>
        </div>
        
        {alert.instructions && (
          <div className="alert-popup-instructions" style={{ marginTop: '8px' }}>
            <p><strong>Instructions:</strong></p>
            <p>{alert.instructions}</p>
          </div>
        )}
        
        <div className="alert-popup-footer" style={{ marginTop: '12px', textAlign: 'right' }}>
          <button 
            className="alert-popup-details-button"
            style={{
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              // Navigate to the alert detail page
              window.location.href = `/alerts/${alert.id}`;
            }}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertPopup;