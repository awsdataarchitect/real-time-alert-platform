import React from 'react';
import './QuickActions.css';

const QuickActions = () => {
  const actions = [
    {
      id: 'emergency',
      title: 'Emergency Contacts',
      description: 'Access emergency contact information',
      icon: '📞',
      action: () => console.log('Emergency contacts')
    },
    {
      id: 'report',
      title: 'Report Incident',
      description: 'Report a new incident or emergency',
      icon: '📝',
      action: () => console.log('Report incident')
    },
    {
      id: 'evacuation',
      title: 'Evacuation Routes',
      description: 'View evacuation routes and safe zones',
      icon: '🚪',
      action: () => console.log('Evacuation routes')
    },
    {
      id: 'resources',
      title: 'Emergency Resources',
      description: 'Find nearby emergency resources',
      icon: '🏥',
      action: () => console.log('Emergency resources')
    }
  ];

  return (
    <div className="quick-actions" data-testid="quick-actions">
      <div className="actions-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-card"
            onClick={action.action}
            aria-describedby={`${action.id}-description`}
          >
            <div className="action-icon" aria-hidden="true">
              {action.icon}
            </div>
            <div className="action-content">
              <h4 className="action-title">{action.title}</h4>
              <p 
                id={`${action.id}-description`}
                className="action-description"
              >
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="emergency-banner">
        <div className="banner-content">
          <span className="banner-icon" aria-hidden="true">🚨</span>
          <div className="banner-text">
            <strong>Emergency Hotline:</strong> 911
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;