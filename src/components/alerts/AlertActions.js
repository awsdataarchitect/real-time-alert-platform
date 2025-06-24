import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';

const client = generateClient();

const AlertActions = ({ alert }) => {
  const [acknowledging, setAcknowledging] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Function to acknowledge an alert
  const acknowledgeAlert = async () => {
    try {
      setAcknowledging(true);
      setActionError(null);
      
      // Get the delivery status ID for this alert for the current user
      const deliveryStatusResponse = await client.graphql({
        query: `
          query GetDeliveryStatusForAlert($alertId: ID!) {
            listDeliveryStatuses(
              alertId: $alertId,
              limit: 1
            ) {
              items {
                id
                status
              }
            }
          }
        `,
        variables: { alertId: alert.id }
      });
      
      const deliveryStatuses = deliveryStatusResponse.data.listDeliveryStatuses.items;
      
      if (deliveryStatuses && deliveryStatuses.length > 0) {
        const deliveryStatusId = deliveryStatuses[0].id;
        
        // Call the acknowledgeAlert mutation
        await client.graphql({
          query: `
            mutation AcknowledgeAlert($deliveryStatusId: ID!) {
              acknowledgeAlert(deliveryStatusId: $deliveryStatusId) {
                id
                status
                acknowledgedAt
              }
            }
          `,
          variables: { deliveryStatusId }
        });
        
        setActionSuccess('Alert acknowledged successfully');
      } else {
        throw new Error('No delivery status found for this alert');
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setActionError(err.message || 'Failed to acknowledge alert');
    } finally {
      setAcknowledging(false);
    }
  };

  // Function to share an alert
  const shareAlert = async () => {
    try {
      setSharing(true);
      setActionError(null);
      
      // Create a shareable URL
      const shareUrl = `${window.location.origin}/alerts/${alert.id}`;
      
      // Use the Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: alert.headline,
          text: alert.description,
          url: shareUrl
        });
        setActionSuccess('Alert shared successfully');
      } else {
        // Fallback to copying to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setActionSuccess('Alert URL copied to clipboard');
      }
    } catch (err) {
      console.error('Error sharing alert:', err);
      setActionError(err.message || 'Failed to share alert');
    } finally {
      setSharing(false);
    }
  };

  // Function to export alert data
  const exportAlertData = () => {
    try {
      setActionError(null);
      
      // Create a JSON blob
      const alertData = JSON.stringify(alert, null, 2);
      const blob = new Blob([alertData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = `alert-${alert.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setActionSuccess('Alert data exported successfully');
    } catch (err) {
      console.error('Error exporting alert data:', err);
      setActionError(err.message || 'Failed to export alert data');
    }
  };

  return (
    <div className="alert-actions">
      {actionError && (
        <div className="alert-action-error" role="alert">
          {actionError}
        </div>
      )}
      
      {actionSuccess && (
        <div className="alert-action-success" role="status">
          {actionSuccess}
        </div>
      )}
      
      <div className="alert-action-buttons">
        <button 
          className="alert-action-button acknowledge-button"
          onClick={acknowledgeAlert}
          disabled={acknowledging}
          aria-busy={acknowledging}
        >
          {acknowledging ? 'Acknowledging...' : 'Acknowledge Alert'}
        </button>
        
        <button 
          className="alert-action-button share-button"
          onClick={shareAlert}
          disabled={sharing}
          aria-busy={sharing}
        >
          {sharing ? 'Sharing...' : 'Share Alert'}
        </button>
        
        <button 
          className="alert-action-button export-button"
          onClick={exportAlertData}
        >
          Export Data
        </button>
      </div>
    </div>
  );
};

export default AlertActions;