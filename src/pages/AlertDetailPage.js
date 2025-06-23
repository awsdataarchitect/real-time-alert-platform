import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AlertDetail from '../components/alerts/AlertDetail';
import { useMap } from '../context/MapContext';

const AlertDetailPage = () => {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const { setSelectedAlert } = useMap();
  
  // Set the selected alert in the map context when this page loads
  useEffect(() => {
    if (alertId) {
      // This will highlight the alert on the map if it's visible
      setSelectedAlert({ id: alertId });
    }
    
    return () => {
      // Clear the selected alert when leaving the page
      setSelectedAlert(null);
    };
  }, [alertId, setSelectedAlert]);
  
  const handleClose = () => {
    // Navigate back to the previous page or to the dashboard
    navigate(-1);
  };
  
  return (
    <div className="alert-detail-page">
      <AlertDetail alertId={alertId} onClose={handleClose} />
    </div>
  );
};

export default AlertDetailPage;