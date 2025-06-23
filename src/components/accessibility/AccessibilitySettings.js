import React from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import AccessibleButton from './AccessibleButton';
import './AccessibilitySettings.css';

const AccessibilitySettings = ({ onClose }) => {
  const {
    fontSize,
    highContrast,
    reducedMotion,
    screenReaderMode,
    keyboardNavigation,
    focusIndicators,
    announcements,
    language,
    setFontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleScreenReaderMode,
    toggleKeyboardNavigation,
    toggleFocusIndicators,
    toggleAnnouncements,
    setLanguage,
    resetSettings,
    announceModalClose
  } = useAccessibility();

  const handleClose = () => {
    announceModalClose();
    if (onClose) onClose();
  };

  const fontSizeOptions = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra Large' }
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'ar', label: 'العربية' }
  ];

  return (
    <div 
      className="accessibility-settings"
      role="dialog"
      aria-labelledby="accessibility-settings-title"
      aria-modal="true"
    >
      <div className="accessibility-settings__header">
        <h2 id="accessibility-settings-title">
          Accessibility Settings
        </h2>
        <AccessibleButton
          variant="ghost"
          onClick={handleClose}
          ariaLabel="Close accessibility settings"
          className="accessibility-settings__close"
        >
          ✕
        </AccessibleButton>
      </div>

      <div className="accessibility-settings__content">
        {/* Font Size */}
        <fieldset className="accessibility-settings__section">
          <legend>Font Size</legend>
          <div className="accessibility-settings__radio-group" role="radiogroup">
            {fontSizeOptions.map((option) => (
              <label key={option.value} className="accessibility-settings__radio-label">
                <input
                  type="radio"
                  name="fontSize"
                  value={option.value}
                  checked={fontSize === option.value}
                  onChange={() => setFontSize(option.value)}
                  className="accessibility-settings__radio"
                />
                <span className="accessibility-settings__radio-text">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Visual Settings */}
        <fieldset className="accessibility-settings__section">
          <legend>Visual Settings</legend>
          
          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={toggleHighContrast}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              High Contrast Mode
            </span>
            <span className="accessibility-settings__toggle-description">
              Increases contrast between text and background colors
            </span>
          </label>

          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={toggleReducedMotion}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              Reduce Motion
            </span>
            <span className="accessibility-settings__toggle-description">
              Minimizes animations and transitions
            </span>
          </label>

          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={focusIndicators}
              onChange={toggleFocusIndicators}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              Focus Indicators
            </span>
            <span className="accessibility-settings__toggle-description">
              Shows visual indicators when elements are focused
            </span>
          </label>
        </fieldset>

        {/* Navigation Settings */}
        <fieldset className="accessibility-settings__section">
          <legend>Navigation Settings</legend>
          
          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={keyboardNavigation}
              onChange={toggleKeyboardNavigation}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              Enhanced Keyboard Navigation
            </span>
            <span className="accessibility-settings__toggle-description">
              Enables advanced keyboard shortcuts and navigation
            </span>
          </label>

          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={screenReaderMode}
              onChange={toggleScreenReaderMode}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              Screen Reader Mode
            </span>
            <span className="accessibility-settings__toggle-description">
              Optimizes interface for screen reader users
            </span>
          </label>
        </fieldset>

        {/* Audio Settings */}
        <fieldset className="accessibility-settings__section">
          <legend>Audio Settings</legend>
          
          <label className="accessibility-settings__toggle">
            <input
              type="checkbox"
              checked={announcements}
              onChange={toggleAnnouncements}
              className="accessibility-settings__checkbox"
            />
            <span className="accessibility-settings__toggle-text">
              Audio Announcements
            </span>
            <span className="accessibility-settings__toggle-description">
              Enables spoken announcements for screen readers
            </span>
          </label>
        </fieldset>

        {/* Language Settings */}
        <fieldset className="accessibility-settings__section">
          <legend>Language</legend>
          <div className="accessibility-settings__select-wrapper">
            <label htmlFor="language-select" className="accessibility-settings__select-label">
              Interface Language
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="accessibility-settings__select"
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>

      <div className="accessibility-settings__footer">
        <AccessibleButton
          variant="secondary"
          onClick={resetSettings}
          ariaLabel="Reset all accessibility settings to defaults"
        >
          Reset to Defaults
        </AccessibleButton>
        
        <AccessibleButton
          variant="primary"
          onClick={handleClose}
        >
          Done
        </AccessibleButton>
      </div>
    </div>
  );
};

export default AccessibilitySettings;