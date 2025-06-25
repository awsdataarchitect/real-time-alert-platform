import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AlertDetail from '../components/alerts/AlertDetail';
import { useMap } from '../context/MapContext';

const AlertDetailPage = () => {
  const { id } = useParams(); // Changed from alertId to id to match route param
  const navigate = useNavigate();
  const { setSelectedAlert } = useMap();
  
  // Set the selected alert in the map context when this page loads
  useEffect(() => {
    if (id) {
      // This will highlight the alert on the map if it's visible
      setSelectedAlert({ id });
    }
    
    return () => {
      // Clear the selected alert when leaving the page
      setSelectedAlert(null);
    };
  }, [id, setSelectedAlert]);
  
  const handleClose = () => {
    // Navigate back to the previous page or to the dashboard
    navigate(-1);
  };
  
  return (
    <div className="alert-detail-page">
      <AlertDetail alertId={id} onClose={handleClose} />
    </div>
  );
};

export default AlertDetailPage;