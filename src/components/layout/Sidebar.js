import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import { handleArrowNavigation, KEYS } from '../../utils/keyboardNavigation';
import './Sidebar.css';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { announceModalOpen, announceModalClose, keyboardNavigation } = useAccessibility();
  const sidebarRef = useRef(null);

  const toggleSidebar = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    
    if (newCollapsedState) {
      announceModalClose();
    } else {
      announceModalOpen('Navigation sidebar');
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event) => {
    if (!keyboardNavigation) return;
    
    if (event.key === KEYS.ESCAPE && !isCollapsed) {
      setIsCollapsed(true);
      announceModalClose();
      return;
    }
    
    handleArrowNavigation(sidebarRef.current, event, {
      orientation: 'vertical',
      selector: '.sidebar-link'
    });
  };

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar && keyboardNavigation) {
      sidebar.addEventListener('keydown', handleKeyDown);
      return () => {
        sidebar.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [keyboardNavigation, isCollapsed]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
    { id: 'alerts', label: 'Active Alerts', icon: '🚨', href: '/alerts' },
    { id: 'map', label: 'Alert Map', icon: '🗺️', href: '/map' },
    { id: 'history', label: 'Alert History', icon: '📋', href: '/history' },
    { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' }
  ];

  return (
    <aside 
      ref={sidebarRef}
      className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}
      role="navigation"
      aria-label="Main navigation"
      aria-expanded={!isCollapsed}
    >
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
      >
        <span aria-hidden="true">{isCollapsed ? '▶' : '◀'}</span>
      </button>

      <nav id="sidebar-nav" className="sidebar-nav">
        <ul className="sidebar-menu" role="menubar">
          {menuItems.map((item) => (
            <li key={item.id} role="none">
              <a
                href={item.href}
                className="sidebar-link"
                role="menuitem"
                title={item.label}
                aria-label={item.label}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sidebar-text">
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;