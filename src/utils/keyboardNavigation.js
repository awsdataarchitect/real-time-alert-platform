/**
 * Keyboard navigation utilities for accessibility
 */

// Key codes for common navigation keys
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
};

/**
 * Check if an element is focusable
 */
export const isFocusable = (element) => {
  if (!element || element.disabled || element.hidden) return false;
  
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ];
  
  return focusableSelectors.some(selector => element.matches(selector)) ||
         (element.tabIndex >= 0 && !element.disabled);
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container) => {
  if (!container) return [];
  
  const focusableSelectors = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])'
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors))
    .filter(element => isFocusable(element) && isVisible(element));
};

/**
 * Check if an element is visible
 */
export const isVisible = (element) => {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
};

/**
 * Trap focus within a container (useful for modals, dropdowns)
 */
export const trapFocus = (container, event) => {
  const focusableElements = getFocusableElements(container);
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (event.key === KEYS.TAB) {
    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
};

/**
 * Handle arrow key navigation in a list
 */
export const handleArrowNavigation = (container, event, options = {}) => {
  const {
    orientation = 'vertical', // 'vertical' | 'horizontal' | 'both'
    loop = true,
    selector = '[role="option"], [role="menuitem"], [role="tab"], button, a'
  } = options;
  
  const elements = Array.from(container.querySelectorAll(selector))
    .filter(element => isFocusable(element) && isVisible(element));
  
  if (elements.length === 0) return;
  
  const currentIndex = elements.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  
  switch (event.key) {
    case KEYS.ARROW_DOWN:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= elements.length) {
          nextIndex = loop ? 0 : elements.length - 1;
        }
      }
      break;
      
    case KEYS.ARROW_UP:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? elements.length - 1 : 0;
        }
      }
      break;
      
    case KEYS.ARROW_RIGHT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= elements.length) {
          nextIndex = loop ? 0 : elements.length - 1;
        }
      }
      break;
      
    case KEYS.ARROW_LEFT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? elements.length - 1 : 0;
        }
      }
      break;
      
    case KEYS.HOME:
      event.preventDefault();
      nextIndex = 0;
      break;
      
    case KEYS.END:
      event.preventDefault();
      nextIndex = elements.length - 1;
      break;
      
    default:
      return;
  }
  
  if (nextIndex !== currentIndex && elements[nextIndex]) {
    elements[nextIndex].focus();
  }
};

/**
 * Create a roving tabindex manager for a group of elements
 */
export class RovingTabIndex {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      selector: '[role="option"], [role="menuitem"], [role="tab"], button, a',
      orientation: 'vertical',
      loop: true,
      ...options
    };
    
    this.currentIndex = 0;
    this.elements = [];
    
    this.init();
  }
  
  init() {
    this.updateElements();
    this.setTabIndexes();
    this.bindEvents();
  }
  
  updateElements() {
    this.elements = Array.from(this.container.querySelectorAll(this.options.selector))
      .filter(element => isFocusable(element) && isVisible(element));
  }
  
  setTabIndexes() {
    this.elements.forEach((element, index) => {
      element.tabIndex = index === this.currentIndex ? 0 : -1;
    });
  }
  
  setCurrentIndex(index) {
    if (index >= 0 && index < this.elements.length) {
      this.currentIndex = index;
      this.setTabIndexes();
    }
  }
  
  focusCurrent() {
    if (this.elements[this.currentIndex]) {
      this.elements[this.currentIndex].focus();
    }
  }
  
  bindEvents() {
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.container.addEventListener('focus', this.handleFocus.bind(this), true);
  }
  
  handleKeyDown(event) {
    handleArrowNavigation(this.container, event, this.options);
  }
  
  handleFocus(event) {
    const index = this.elements.indexOf(event.target);
    if (index !== -1) {
      this.setCurrentIndex(index);
    }
  }
  
  destroy() {
    this.container.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.container.removeEventListener('focus', this.handleFocus.bind(this), true);
  }
}

/**
 * Announce text to screen readers
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', priority);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.textContent = message;
  
  document.body.appendChild(announcer);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcer);
  }, 1000);
};

/**
 * Skip link functionality
 */
export const createSkipLink = (targetId, text = 'Skip to main content') => {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = text;
  
  skipLink.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  return skipLink;
};

/**
 * Focus management for single page applications
 */
export class FocusManager {
  constructor() {
    this.focusHistory = [];
    this.currentFocus = null;
  }
  
  saveFocus() {
    if (document.activeElement && document.activeElement !== document.body) {
      this.focusHistory.push(document.activeElement);
    }
  }
  
  restoreFocus() {
    const lastFocus = this.focusHistory.pop();
    if (lastFocus && isFocusable(lastFocus) && isVisible(lastFocus)) {
      lastFocus.focus();
      return true;
    }
    return false;
  }
  
  setFocus(element, options = {}) {
    const { preventScroll = false, announce = false } = options;
    
    if (element && isFocusable(element)) {
      element.focus({ preventScroll });
      
      if (announce) {
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('title') || 
                     element.textContent || 
                     'Element focused';
        announceToScreenReader(`Focused: ${label}`);
      }
      
      return true;
    }
    return false;
  }
  
  focusFirstIn(container) {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      return this.setFocus(focusableElements[0]);
    }
    return false;
  }
  
  focusLastIn(container) {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      return this.setFocus(focusableElements[focusableElements.length - 1]);
    }
    return false;
  }
}

// Global focus manager instance
export const focusManager = new FocusManager();