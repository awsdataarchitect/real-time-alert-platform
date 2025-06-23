import React, { useState, useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useMap } from '../../context/MapContext';
import AlertActions from './AlertActions';
import AlertTimeline from './AlertTimeline';
import AlertRelated from './AlertRelated';
import './AlertDetail.css';

const AlertDetail = ({ alertId, onClose }) => {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAlertSeverityColor, getAlertCategoryIcon } = useMap();

  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId) return;
      
      try {
        setLoading(true);
        const response = await API.graphql(
          graphqlOperation(`
            query GetAlertDetails($alertId: ID!) {
              getAlert(id: $alertId) {
                id
                sourceId
                sourceType
                category
                eventType
                subType
                severity
                certainty
                headline
                description
                instructions
                createdAt
                updatedAt
                startTime
                endTime
                status
                location {
                  type
                  coordinates
                }
                affectedAreas {
                  areaId
                  areaName
                  areaType
                  geometry
                }
                resources {
                  resourceType
                  mimeType
                  uri
                  description
                }
                parameters
                aiInsights {
                  analysis
                  recommendations
                  confidenceScore
                  sources
                }
                version
              }
            }
          `, { alertId })
        );
        
        const alertData = response.data.getAlert;
        setAlert(alertData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching alert details:', err);
        setError(err);
        setLoading(false);
      }
    };

    fetchAlertDetails();
  }, [alertId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="alert-detail-loading">Loading alert details...</div>;
  }

  if (error) {
    return <div className="alert-detail-error">Error loading alert details: {error.message}</div>;
  }

  if (!alert) {
    return <div className="alert-detail-not-found">Alert not found</div>;
  }

  const severityColor = getAlertSeverityColor(alert.severity);
  const categoryIcon = getAlertCategoryIcon(alert.category);

  return (
    <div className="alert-detail-container">
      <div className="alert-detail-header" style={{ backgroundColor: severityColor }}>
        <div className="alert-detail-category-icon">
          <i className={`icon-${categoryIcon}`} aria-hidden="true"></i>
        </div>
        <div className="alert-detail-title">
          <h2>{alert.headline}</h2>
          <div className="alert-detail-meta">
            <span className="alert-detail-severity">{alert.severity}</span>
            <span className="alert-detail-category">{alert.category}</span>
            <span className="alert-detail-status">{alert.status}</span>
          </div>
        </div>
        <button 
          className="alert-detail-close-button" 
          onClick={onClose}
          aria-label="Close alert details"
        >
          &times;
        </button>
      </div>

      <div className="alert-detail-content">
        <div className="alert-detail-section">
          <h3>Description</h3>
          <p>{alert.description}</p>
        </div>

        {alert.instructions && (
          <div className="alert-detail-section alert-detail-instructions">
            <h3>Instructions</h3>
            <p>{alert.instructions}</p>
          </div>
        )}

        <div className="alert-detail-section alert-detail-timing">
          <h3>Timing</h3>
          <div className="alert-detail-timing-grid">
            <div>
              <strong>Start Time:</strong>
              <span>{formatDate(alert.startTime)}</span>
            </div>
            <div>
              <strong>End Time:</strong>
              <span>{alert.endTime ? formatDate(alert.endTime) : 'Ongoing'}</span>
            </div>
            <div>
              <strong>Created:</strong>
              <span>{formatDate(alert.createdAt)}</span>
            </div>
            <div>
              <strong>Updated:</strong>
              <span>{formatDate(alert.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="alert-detail-section alert-detail-metadata">
          <h3>Additional Information</h3>
          <div className="alert-detail-metadata-grid">
            <div>
              <strong>Source:</strong>
              <span>{alert.sourceType}</span>
            </div>
            <div>
              <strong>Source ID:</strong>
              <span>{alert.sourceId}</span>
            </div>
            <div>
              <strong>Event Type:</strong>
              <span>{alert.eventType}</span>
            </div>
            {alert.subType && (
              <div>
                <strong>Sub Type:</strong>
                <span>{alert.subType}</span>
              </div>
            )}
            <div>
              <strong>Certainty:</strong>
              <span>{alert.certainty}</span>
            </div>
            <div>
              <strong>Version:</strong>
              <span>{alert.version}</span>
            </div>
          </div>
        </div>

        {alert.affectedAreas && alert.affectedAreas.length > 0 && (
          <div className="alert-detail-section alert-detail-affected-areas">
            <h3>Affected Areas</h3>
            <ul className="alert-detail-area-list">
              {alert.affectedAreas.map((area) => (
                <li key={area.areaId}>
                  <strong>{area.areaName}</strong> ({area.areaType})
                </li>
              ))}
            </ul>
          </div>
        )}

        {alert.resources && alert.resources.length > 0 && (
          <div className="alert-detail-section alert-detail-resources">
            <h3>Resources</h3>
            <ul className="alert-detail-resource-list">
              {alert.resources.map((resource, index) => (
                <li key={index}>
                  <a 
                    href={resource.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="alert-detail-resource-link"
                  >
                    {resource.description || resource.resourceType}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {alert.aiInsights && (
          <div className="alert-detail-section alert-detail-ai-insights">
            <h3>AI Insights</h3>
            {alert.aiInsights.analysis && (
              <div className="alert-detail-analysis">
                <h4>Analysis</h4>
                <p>{alert.aiInsights.analysis}</p>
              </div>
            )}
            
            {alert.aiInsights.recommendations && alert.aiInsights.recommendations.length > 0 && (
              <div className="alert-detail-recommendations">
                <h4>Recommendations</h4>
                <ul>
                  {alert.aiInsights.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {alert.aiInsights.sources && alert.aiInsights.sources.length > 0 && (
              <div className="alert-detail-sources">
                <h4>Sources</h4>
                <ul>
                  {alert.aiInsights.sources.map((source, index) => (
                    <li key={index}>{source}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {alert.aiInsights.confidenceScore && (
              <div className="alert-detail-confidence">
                <h4>Confidence Score</h4>
                <p>{(alert.aiInsights.confidenceScore * 100).toFixed(1)}%</p>
              </div>
            )}
          </div>
        )}

        <AlertTimeline alert={alert} />
        
        <AlertRelated alertId={alertId} eventType={alert.eventType} subType={alert.subType} />
      </div>

      <div className="alert-detail-footer">
        <AlertActions alert={alert} />
      </div>
    </div>
  );
};

export default AlertDetail;