import React, { useState } from 'react';
import { useMap } from '../../context/MapContext';
import TimelineVisualization from './TimelineVisualization';
import TrendVisualization from './TrendVisualization';

const AlertTimeline = ({ alert }) => {
  const { getAlertSeverityColor } = useMap();
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'trends', 'visualization'
  
  // Format date for timeline display
  const formatTimelineDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Calculate the current position in the timeline (as percentage)
  const calculateTimelinePosition = () => {
    if (!alert.startTime) return 0;
    
    const startTime = new Date(alert.startTime).getTime();
    const endTime = alert.endTime ? new Date(alert.endTime).getTime() : null;
    const currentTime = Date.now();
    
    // If the alert has ended, show 100%
    if (endTime && currentTime > endTime) return 100;
    
    // If the alert hasn't started yet, show 0%
    if (currentTime < startTime) return 0;
    
    // If the alert is ongoing with no end time, show 50%
    if (!endTime) return 50;
    
    // Calculate percentage between start and end
    const totalDuration = endTime - startTime;
    const elapsedDuration = currentTime - startTime;
    const percentage = (elapsedDuration / totalDuration) * 100;
    
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0 and 100
  };
  
  // Get timeline events
  const getTimelineEvents = () => {
    const events = [];
    
    // Add creation event
    if (alert.createdAt) {
      events.push({
        time: new Date(alert.createdAt).getTime(),
        label: 'Alert Created',
        description: `Alert was created in the system`,
        type: 'creation'
      });
    }
    
    // Add start event
    if (alert.startTime) {
      events.push({
        time: new Date(alert.startTime).getTime(),
        label: 'Alert Start',
        description: `Alert became active`,
        type: 'start'
      });
    }
    
    // Add update event if different from creation
    if (alert.updatedAt && alert.updatedAt !== alert.createdAt) {
      events.push({
        time: new Date(alert.updatedAt).getTime(),
        label: 'Alert Updated',
        description: `Alert information was updated`,
        type: 'update'
      });
    }
    
    // Add end event if available
    if (alert.endTime) {
      events.push({
        time: new Date(alert.endTime).getTime(),
        label: 'Alert End',
        description: `Alert is scheduled to end`,
        type: 'end'
      });
    }
    
    // Sort events by time
    return events.sort((a, b) => a.time - b.time);
  };
  
  const timelineEvents = getTimelineEvents();
  const timelinePosition = calculateTimelinePosition();
  const severityColor = getAlertSeverityColor(alert.severity);
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  return (
    <div className="alert-detail-section alert-timeline">
      <div className="alert-timeline-header">
        <h3>Timeline & Trends</h3>
        
        <div className="alert-timeline-tabs">
          <button 
            className={`alert-timeline-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => handleTabChange('timeline')}
            aria-label="Show alert timeline"
          >
            Timeline
          </button>
          <button 
            className={`alert-timeline-tab ${activeTab === 'visualization' ? 'active' : ''}`}
            onClick={() => handleTabChange('visualization')}
            aria-label="Show timeline visualization"
          >
            Timeline Visualization
          </button>
          <button 
            className={`alert-timeline-tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => handleTabChange('trends')}
            aria-label="Show trend analysis"
          >
            Trend Analysis
          </button>
        </div>
      </div>
      
      {activeTab === 'timeline' && (
        <div className="alert-timeline-container">
          {/* Timeline bar */}
          <div className="alert-timeline-bar">
            <div 
              className="alert-timeline-progress" 
              style={{ 
                width: `${timelinePosition}%`,
                backgroundColor: severityColor
              }}
            ></div>
            
            {/* Current time indicator */}
            {timelinePosition > 0 && timelinePosition < 100 && (
              <div 
                className="alert-timeline-current-indicator"
                style={{ left: `${timelinePosition}%` }}
              ></div>
            )}
            
            {/* Timeline events */}
            {timelineEvents.map((event, index) => {
              // Calculate position as percentage of total time
              const startTime = alert.startTime ? new Date(alert.startTime).getTime() : timelineEvents[0].time;
              const endTime = alert.endTime ? new Date(alert.endTime).getTime() : 
                             (Date.now() > startTime ? Date.now() + 86400000 : startTime + 86400000); // Add 24h if no end time
              
              const totalDuration = endTime - startTime;
              const eventPosition = ((event.time - startTime) / totalDuration) * 100;
              
              return (
                <div 
                  key={index}
                  className={`alert-timeline-event alert-timeline-event-${event.type}`}
                  style={{ left: `${eventPosition}%` }}
                >
                  <div className="alert-timeline-event-marker"></div>
                  <div className="alert-timeline-event-label">{event.label}</div>
                  <div className="alert-timeline-event-time">{formatTimelineDate(new Date(event.time))}</div>
                </div>
              );
            })}
          </div>
          
          {/* Timeline legend */}
          <div className="alert-timeline-legend">
            <div className="alert-timeline-legend-item">
              <span className="alert-timeline-legend-marker creation"></span>
              <span>Created</span>
            </div>
            <div className="alert-timeline-legend-item">
              <span className="alert-timeline-legend-marker start"></span>
              <span>Started</span>
            </div>
            <div className="alert-timeline-legend-item">
              <span className="alert-timeline-legend-marker update"></span>
              <span>Updated</span>
            </div>
            <div className="alert-timeline-legend-item">
              <span className="alert-timeline-legend-marker end"></span>
              <span>Ended/Scheduled End</span>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'visualization' && (
        <TimelineVisualization alertCategory={alert.category} alertType={alert.eventType} />
      )}
      
      {activeTab === 'trends' && (
        <TrendVisualization alertCategory={alert.category} alertType={alert.eventType} />
      )}
    </div>
  );
};

export default AlertTimeline;