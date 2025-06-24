import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
const client = generateClient();
import { useMap } from '../../context/MapContext';

const AlertRelated = ({ alertId, eventType, subType }) => {
  const [relatedAlerts, setRelatedAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAlertSeverityColor } = useMap();

  useEffect(() => {
    const fetchRelatedAlerts = async () => {
      if (!alertId || !eventType) return;
      
      try {
        setLoading(true);
        
        // Query for alerts with the same event type
        const filterParams = {
          eventType: { eq: eventType }
        };
        
        // Add subType filter if available
        if (subType) {
          filterParams.subType = { eq: subType };
        }
        
        const response = await client.graphql({
          query: `
            query GetRelatedAlerts($filter: AlertFilterInput!, $limit: Int!) {
              listAlerts(
                filter: $filter
                limit: $limit
              ) {
                items {
                  id
                  headline
                  severity
                  category
                  startTime
                  status
                  location {
                    type
                    coordinates
                  }
                }
              }
            }
          `,
          variables: { 
            filter: filterParams,
            limit: 5
          }
        });
        
        // Filter out the current alert
        const alertsData = response.data.listAlerts.items.filter(
          alert => alert.id !== alertId
        );
        
        setRelatedAlerts(alertsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching related alerts:', err);
        setError(err);
        setLoading(false);
      }
    };

    fetchRelatedAlerts();
  }, [alertId, eventType, subType]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="alert-detail-section alert-related">
        <h3>Related Alerts</h3>
        <div className="alert-related-loading">Loading related alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-detail-section alert-related">
        <h3>Related Alerts</h3>
        <div className="alert-related-error">Error loading related alerts</div>
      </div>
    );
  }

  if (relatedAlerts.length === 0) {
    return (
      <div className="alert-detail-section alert-related">
        <h3>Related Alerts</h3>
        <div className="alert-related-empty">No related alerts found</div>
      </div>
    );
  }

  return (
    <div className="alert-detail-section alert-related">
      <h3>Related Alerts</h3>
      
      <div className="alert-related-list">
        {relatedAlerts.map(alert => {
          const severityColor = getAlertSeverityColor(alert.severity);
          
          return (
            <div 
              key={alert.id} 
              className="alert-related-item"
              onClick={() => window.location.href = `/alerts/${alert.id}`}
            >
              <div 
                className="alert-related-severity-indicator"
                style={{ backgroundColor: severityColor }}
              ></div>
              
              <div className="alert-related-content">
                <div className="alert-related-headline">{alert.headline}</div>
                
                <div className="alert-related-meta">
                  <span className="alert-related-category">{alert.category}</span>
                  <span className="alert-related-date">{formatDate(alert.startTime)}</span>
                  <span className="alert-related-status">{alert.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertRelated;