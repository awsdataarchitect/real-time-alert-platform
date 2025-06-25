import React from 'react';
import './AlertDetail.css';

const AlertTimeline = ({ alert }) => {
  // Make sure we have valid dates before creating timeline events
  const createdAt = alert?.createdAt ? new Date(alert.createdAt) : new Date();
  const updatedAt = alert?.updatedAt ? new Date(alert.updatedAt) : createdAt;
  
  // Ensure dates are valid before creating ISO strings
  const isValidDate = (date) => !isNaN(date.getTime());
  
  // Create notification time (1 minute after creation)
  const notificationTime = new Date(createdAt);
  notificationTime.setMinutes(notificationTime.getMinutes() + 1);
  
  // Mock timeline events with safe date handling
  const timelineEvents = [
    {
      id: 1,
      type: 'created',
      timestamp: isValidDate(createdAt) ? createdAt.toISOString() : new Date().toISOString(),
      description: 'Alert created'
    },
    {
      id: 2,
      type: 'updated',
      timestamp: isValidDate(updatedAt) ? updatedAt.toISOString() : new Date().toISOString(),
      description: 'Alert details updated'
    },
    {
      id: 3,
      type: 'notification',
      timestamp: isValidDate(notificationTime) ? notificationTime.toISOString() : new Date().toISOString(),
      description: 'Notifications sent to affected users'
    }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="alert-detail-section alert-detail-timeline">
      <h3>Timeline</h3>
      <div className="timeline">
        {timelineEvents.map((event) => (
          <div key={event.id} className={`timeline-event ${event.type}`}>
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <div className="timeline-time">{formatDate(event.timestamp)}</div>
              <div className="timeline-description">{event.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertTimeline;
