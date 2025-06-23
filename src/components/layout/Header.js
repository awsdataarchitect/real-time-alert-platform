import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import AccessibilitySettings from '../accessibility/AccessibilitySettings';
import AccessibleButton from '../accessibility/AccessibleButton';
import { focusManager } from '../../utils/keyboardNavigation';
import './Header.css';

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const { 
    toggleHighContrast, 
    highContrast, 
    announceModalOpen,
    announceModalClose 
  } = useAccessibility();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessibilitySettingsOpen, setAccessibilitySettingsOpen] = useState(false);

  const toggleMenu = () => {
    const newMenuState = !menuOpen;
    setMenuOpen(newMenuState);
    
    if (newMenuState) {
      announceModalOpen('Navigation menu');
      // Focus first menu item
      setTimeout(() => {
        const firstMenuItem = document.querySelector('.nav-list a');
        if (firstMenuItem) {
          focusManager.setFocus(firstMenuItem);
        }
      }, 100);
    } else {
      announceModalClose();
    }
  };

  const openAccessibilitySettings = () => {
    setAccessibilitySettingsOpen(true);
    announceModalOpen('Accessibility Settings');
  };

  const closeAccessibilitySettings = () => {
    setAccessibilitySettingsOpen(false);
    announceModalClose();
  };

  return (
    <header className="header" role="banner">
      <div className="header-content">
        <div className="header-left">
          <button 
            className="menu-toggle"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <span className="hamburger"></span>
          </button>
          <h1 className="app-title">
            <span className="title-icon" aria-hidden="true">🚨</span>
            Real-Time Alert Platform
          </h1>
        </div>
        
        <nav className={`header-nav ${menuOpen ? 'nav-open' : ''}`} role="navigation">
          <ul className="nav-list">
            <li><a href="/" className="nav-link">Dashboard</a></li>
            <li><a href="/settings" className="nav-link">Settings</a></li>
          </ul>
        </nav>

        <div className="header-actions">
          <AccessibleButton
            variant="ghost"
            onClick={openAccessibilitySettings}
            ariaLabel="Open accessibility settings"
            className="accessibility-btn"
          >
            <span aria-hidden="true">♿</span>
          </AccessibleButton>
          
          <AccessibleButton
            variant="ghost"
            onClick={toggleHighContrast}
            ariaLabel={`${highContrast ? 'Disable' : 'Enable'} high contrast mode`}
            className="accessibility-btn"
          >
            <span aria-hidden="true">🔍</span>
          </AccessibleButton>
          
          <AccessibleButton
            variant="ghost"
            onClick={toggleTheme}
            ariaLabel={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="theme-toggle"
          >
            <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
          </AccessibleButton>
        </div>
      </div>
      
      {accessibilitySettingsOpen && (
        <>
          <div 
            className="modal-overlay" 
            onClick={closeAccessibilitySettings}
            aria-hidden="true"
          />
          <AccessibilitySettings onClose={closeAccessibilitySettings} />
        </>
      )}
    </header>
  );
};

export default Header;