import React from 'react';
import './AlertDetail.css';

const AlertActions = ({ alert }) => {
  const handleShare = () => {
    alert('Share functionality would be implemented here');
  };

  const handleSubscribe = () => {
    alert('Subscribe functionality would be implemented here');
  };

  const handleExport = () => {
    alert('Export functionality would be implemented here');
  };

  const handleReport = () => {
    alert('Report functionality would be implemented here');
  };

  return (
    <div className="alert-actions">
      <button 
        className="action-button share-button"
        onClick={handleShare}
        aria-label="Share this alert"
      >
        <span className="action-icon">📤</span>
        <span className="action-text">Share</span>
      </button>
      
      <button 
        className="action-button subscribe-button"
        onClick={handleSubscribe}
        aria-label="Subscribe to updates"
      >
        <span className="action-icon">🔔</span>
        <span className="action-text">Subscribe</span>
      </button>
      
      <button 
        className="action-button export-button"
        onClick={handleExport}
        aria-label="Export alert data"
      >
        <span className="action-icon">📥</span>
        <span className="action-text">Export</span>
      </button>
      
      <button 
        className="action-button report-button"
        onClick={handleReport}
        aria-label="Report an issue with this alert"
      >
        <span className="action-icon">⚠️</span>
        <span className="action-text">Report</span>
      </button>
    </div>
  );
};

export default AlertActions;
