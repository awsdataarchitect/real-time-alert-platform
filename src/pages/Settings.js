import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './Settings.css';

const Settings = () => {
  const { theme, highContrast, fontSize, toggleTheme, toggleHighContrast, changeFontSize } = useTheme();

  const fontSizeOptions = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra Large' }
  ];

  return (
    <div className="settings" data-testid="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <p className="settings-subtitle">
          Customize your alert platform experience
        </p>
      </div>

      <div className="settings-content">
        <section className="settings-section" aria-labelledby="appearance-heading">
          <h3 id="appearance-heading">Appearance</h3>
          
          <div className="setting-group">
            <label className="setting-label">
              <span>Theme</span>
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-describedby="theme-description"
              >
                {theme === 'light' ? 'Light' : 'Dark'}
              </button>
            </label>
            <p id="theme-description" className="setting-description">
              Choose between light and dark themes
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>High Contrast</span>
              <button
                className={`toggle-btn ${highContrast ? 'active' : ''}`}
                onClick={toggleHighContrast}
                aria-describedby="contrast-description"
                aria-pressed={highContrast}
              >
                {highContrast ? 'On' : 'Off'}
              </button>
            </label>
            <p id="contrast-description" className="setting-description">
              Increase contrast for better visibility
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>Font Size</span>
              <select
                value={fontSize}
                onChange={(e) => changeFontSize(e.target.value)}
                className="font-size-select"
                aria-describedby="font-size-description"
              >
                {fontSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="font-size-description" className="setting-description">
              Adjust text size for better readability
            </p>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="notifications-heading">
          <h3 id="notifications-heading">Notifications</h3>
          
          <div className="setting-group">
            <label className="setting-label">
              <span>Browser Notifications</span>
              <button className="toggle-btn" aria-pressed="false">
                Off
              </button>
            </label>
            <p className="setting-description">
              Receive alerts through browser notifications
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>Sound Alerts</span>
              <button className="toggle-btn" aria-pressed="false">
                Off
              </button>
            </label>
            <p className="setting-description">
              Play sound when new alerts arrive
            </p>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="accessibility-heading">
          <h3 id="accessibility-heading">Accessibility</h3>
          
          <div className="setting-group">
            <label className="setting-label">
              <span>Screen Reader Support</span>
              <button className="toggle-btn active" aria-pressed="true">
                On
              </button>
            </label>
            <p className="setting-description">
              Enhanced support for screen readers
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>Keyboard Navigation</span>
              <button className="toggle-btn active" aria-pressed="true">
                On
              </button>
            </label>
            <p className="setting-description">
              Navigate using keyboard shortcuts
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;