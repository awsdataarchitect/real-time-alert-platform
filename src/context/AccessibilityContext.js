import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { liveRegionManager, navigationUtils } from '../utils/screenReader';

const AccessibilityContext = createContext();

// Action types
const ACCESSIBILITY_ACTIONS = {
  SET_FONT_SIZE: 'SET_FONT_SIZE',
  SET_HIGH_CONTRAST: 'SET_HIGH_CONTRAST',
  SET_REDUCED_MOTION: 'SET_REDUCED_MOTION',
  SET_SCREEN_READER_MODE: 'SET_SCREEN_READER_MODE',
  SET_KEYBOARD_NAVIGATION: 'SET_KEYBOARD_NAVIGATION',
  SET_FOCUS_INDICATORS: 'SET_FOCUS_INDICATORS',
  TOGGLE_ANNOUNCEMENTS: 'TOGGLE_ANNOUNCEMENTS',
  SET_LANGUAGE: 'SET_LANGUAGE',
  RESET_SETTINGS: 'RESET_SETTINGS'
};

// Initial state
const initialState = {
  fontSize: 'medium', // 'small', 'medium', 'large', 'extra-large'
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigation: true,
  focusIndicators: true,
  announcements: true,
  language: 'en',
  preferences: {
    skipLinks: true,
    headingNavigation: true,
    landmarkNavigation: true,
    formLabeling: true,
    errorAnnouncements: true,
    statusAnnouncements: true,
    progressAnnouncements: true
  }
};

// Reducer
const accessibilityReducer = (state, action) => {
  switch (action.type) {
    case ACCESSIBILITY_ACTIONS.SET_FONT_SIZE:
      return {
        ...state,
        fontSize: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.SET_HIGH_CONTRAST:
      return {
        ...state,
        highContrast: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.SET_REDUCED_MOTION:
      return {
        ...state,
        reducedMotion: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.SET_SCREEN_READER_MODE:
      return {
        ...state,
        screenReaderMode: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.SET_KEYBOARD_NAVIGATION:
      return {
        ...state,
        keyboardNavigation: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.SET_FOCUS_INDICATORS:
      return {
        ...state,
        focusIndicators: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.TOGGLE_ANNOUNCEMENTS:
      return {
        ...state,
        announcements: !state.announcements
      };
      
    case ACCESSIBILITY_ACTIONS.SET_LANGUAGE:
      return {
        ...state,
        language: action.payload
      };
      
    case ACCESSIBILITY_ACTIONS.RESET_SETTINGS:
      return {
        ...initialState,
        language: state.language // Keep language setting
      };
      
    default:
      return state;
  }
};

// Provider component
export const AccessibilityProvider = ({ children }) => {
  const [state, dispatch] = useReducer(accessibilityReducer, initialState);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        Object.keys(settings).forEach(key => {
          if (key in initialState) {
            dispatch({
              type: `SET_${key.toUpperCase()}`,
              payload: settings[key]
            });
          }
        });
      } catch (error) {
        console.error('Error loading accessibility settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(state));
  }, [state]);

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Font size
    root.setAttribute('data-font-size', state.fontSize);
    
    // High contrast
    root.setAttribute('data-high-contrast', state.highContrast.toString());
    
    // Reduced motion
    if (state.reducedMotion) {
      root.style.setProperty('--transition-fast', '0ms');
      root.style.setProperty('--transition-normal', '0ms');
      root.style.setProperty('--transition-slow', '0ms');
    } else {
      root.style.removeProperty('--transition-fast');
      root.style.removeProperty('--transition-normal');
      root.style.removeProperty('--transition-slow');
    }
    
    // Focus indicators
    if (!state.focusIndicators) {
      root.classList.add('no-focus-indicators');
    } else {
      root.classList.remove('no-focus-indicators');
    }
    
    // Screen reader mode
    if (state.screenReaderMode) {
      root.classList.add('screen-reader-mode');
    } else {
      root.classList.remove('screen-reader-mode');
    }
    
    // Language
    root.setAttribute('lang', state.language);
    
  }, [state]);

  // Detect system preferences
  useEffect(() => {
    // Detect prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches) {
      dispatch({
        type: ACCESSIBILITY_ACTIONS.SET_REDUCED_MOTION,
        payload: true
      });
    }
    
    const handleReducedMotionChange = (e) => {
      dispatch({
        type: ACCESSIBILITY_ACTIONS.SET_REDUCED_MOTION,
        payload: e.matches
      });
    };
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    
    // Detect high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    if (highContrastQuery.matches) {
      dispatch({
        type: ACCESSIBILITY_ACTIONS.SET_HIGH_CONTRAST,
        payload: true
      });
    }
    
    const handleHighContrastChange = (e) => {
      dispatch({
        type: ACCESSIBILITY_ACTIONS.SET_HIGH_CONTRAST,
        payload: e.matches
      });
    };
    
    highContrastQuery.addEventListener('change', handleHighContrastChange);
    
    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, []);

  // Action creators
  const setFontSize = (size) => {
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_FONT_SIZE,
      payload: size
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(`Font size changed to ${size}`);
    }
  };

  const toggleHighContrast = () => {
    const newValue = !state.highContrast;
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_HIGH_CONTRAST,
      payload: newValue
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(
        `High contrast mode ${newValue ? 'enabled' : 'disabled'}`
      );
    }
  };

  const toggleReducedMotion = () => {
    const newValue = !state.reducedMotion;
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_REDUCED_MOTION,
      payload: newValue
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(
        `Reduced motion ${newValue ? 'enabled' : 'disabled'}`
      );
    }
  };

  const toggleScreenReaderMode = () => {
    const newValue = !state.screenReaderMode;
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_SCREEN_READER_MODE,
      payload: newValue
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(
        `Screen reader mode ${newValue ? 'enabled' : 'disabled'}`
      );
    }
  };

  const toggleKeyboardNavigation = () => {
    const newValue = !state.keyboardNavigation;
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_KEYBOARD_NAVIGATION,
      payload: newValue
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(
        `Keyboard navigation ${newValue ? 'enabled' : 'disabled'}`
      );
    }
  };

  const toggleFocusIndicators = () => {
    const newValue = !state.focusIndicators;
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_FOCUS_INDICATORS,
      payload: newValue
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(
        `Focus indicators ${newValue ? 'enabled' : 'disabled'}`
      );
    }
  };

  const toggleAnnouncements = () => {
    dispatch({
      type: ACCESSIBILITY_ACTIONS.TOGGLE_ANNOUNCEMENTS
    });
  };

  const setLanguage = (language) => {
    dispatch({
      type: ACCESSIBILITY_ACTIONS.SET_LANGUAGE,
      payload: language
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus(`Language changed to ${language}`);
    }
  };

  const resetSettings = () => {
    dispatch({
      type: ACCESSIBILITY_ACTIONS.RESET_SETTINGS
    });
    
    if (state.announcements) {
      liveRegionManager.announceStatus('Accessibility settings reset to defaults');
    }
  };

  // Utility functions
  const announcePageChange = (pageName) => {
    if (state.announcements) {
      navigationUtils.announcePageChange(pageName);
    }
  };

  const announceModalOpen = (modalTitle) => {
    if (state.announcements) {
      navigationUtils.announceModalOpen(modalTitle);
    }
  };

  const announceModalClose = () => {
    if (state.announcements) {
      navigationUtils.announceModalClose();
    }
  };

  const announceError = (error, context) => {
    if (state.announcements && state.preferences.errorAnnouncements) {
      liveRegionManager.announceAlert(
        context ? `Error in ${context}: ${error}` : `Error: ${error}`
      );
    }
  };

  const announceSuccess = (message) => {
    if (state.announcements && state.preferences.statusAnnouncements) {
      liveRegionManager.announceStatus(message);
    }
  };

  const announceProgress = (current, total, label) => {
    if (state.announcements && state.preferences.progressAnnouncements) {
      const percentage = Math.round((current / total) * 100);
      liveRegionManager.announceStatus(
        `${label}: ${current} of ${total}, ${percentage} percent complete`
      );
    }
  };

  const value = {
    // State
    ...state,
    
    // Actions
    setFontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleScreenReaderMode,
    toggleKeyboardNavigation,
    toggleFocusIndicators,
    toggleAnnouncements,
    setLanguage,
    resetSettings,
    
    // Utilities
    announcePageChange,
    announceModalOpen,
    announceModalClose,
    announceError,
    announceSuccess,
    announceProgress
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// Hook to use accessibility context
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export default AccessibilityContext;