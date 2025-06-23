import {
  KEYS,
  isFocusable,
  isVisible,
  getFocusableElements,
  trapFocus,
  handleArrowNavigation,
  RovingTabIndex,
  announceToScreenReader,
  createSkipLink,
  FocusManager,
  focusManager
} from '../../../src/utils/keyboardNavigation';

describe('Keyboard Navigation Utilities', () => {
  beforeEach(() => {
    // Clear document body
    document.body.innerHTML = '';
    
    // Reset focus
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });

  describe('KEYS constant', () => {
    test('contains all expected key values', () => {
      expect(KEYS.ENTER).toBe('Enter');
      expect(KEYS.SPACE).toBe(' ');
      expect(KEYS.ESCAPE).toBe('Escape');
      expect(KEYS.TAB).toBe('Tab');
      expect(KEYS.ARROW_UP).toBe('ArrowUp');
      expect(KEYS.ARROW_DOWN).toBe('ArrowDown');
      expect(KEYS.ARROW_LEFT).toBe('ArrowLeft');
      expect(KEYS.ARROW_RIGHT).toBe('ArrowRight');
      expect(KEYS.HOME).toBe('Home');
      expect(KEYS.END).toBe('End');
    });
  });

  describe('isFocusable', () => {
    test('returns true for focusable elements', () => {
      const button = document.createElement('button');
      const link = document.createElement('a');
      link.href = '#';
      const input = document.createElement('input');
      const select = document.createElement('select');
      const textarea = document.createElement('textarea');
      
      expect(isFocusable(button)).toBe(true);
      expect(isFocusable(link)).toBe(true);
      expect(isFocusable(input)).toBe(true);
      expect(isFocusable(select)).toBe(true);
      expect(isFocusable(textarea)).toBe(true);
    });

    test('returns false for non-focusable elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      const disabledButton = document.createElement('button');
      disabledButton.disabled = true;
      
      expect(isFocusable(div)).toBe(false);
      expect(isFocusable(span)).toBe(false);
      expect(isFocusable(disabledButton)).toBe(false);
      expect(isFocusable(null)).toBe(false);
    });

    test('handles tabindex correctly', () => {
      const divWithTabIndex = document.createElement('div');
      divWithTabIndex.tabIndex = 0;
      
      const divWithNegativeTabIndex = document.createElement('div');
      divWithNegativeTabIndex.tabIndex = -1;
      
      expect(isFocusable(divWithTabIndex)).toBe(true);
      expect(isFocusable(divWithNegativeTabIndex)).toBe(false);
    });
  });

  describe('isVisible', () => {
    test('returns true for visible elements', () => {
      const div = document.createElement('div');
      div.style.width = '100px';
      div.style.height = '100px';
      document.body.appendChild(div);
      
      expect(isVisible(div)).toBe(true);
      
      document.body.removeChild(div);
    });

    test('returns false for hidden elements', () => {
      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.display = 'none';
      document.body.appendChild(hiddenDiv);
      
      const invisibleDiv = document.createElement('div');
      invisibleDiv.style.visibility = 'hidden';
      document.body.appendChild(invisibleDiv);
      
      const transparentDiv = document.createElement('div');
      transparentDiv.style.opacity = '0';
      document.body.appendChild(transparentDiv);
      
      expect(isVisible(hiddenDiv)).toBe(false);
      expect(isVisible(invisibleDiv)).toBe(false);
      expect(isVisible(transparentDiv)).toBe(false);
      expect(isVisible(null)).toBe(false);
      
      document.body.removeChild(hiddenDiv);
      document.body.removeChild(invisibleDiv);
      document.body.removeChild(transparentDiv);
    });
  });

  describe('getFocusableElements', () => {
    test('returns all focusable elements in container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <a href="#">Link</a>
        <input type="text" />
        <button disabled>Disabled Button</button>
        <div tabindex="0">Focusable Div</div>
        <div tabindex="-1">Non-focusable Div</div>
        <div style="display: none;"><button>Hidden Button</button></div>
      `;
      document.body.appendChild(container);
      
      const focusableElements = getFocusableElements(container);
      
      // Should find: button, link, input, focusable div (4 elements)
      // Should exclude: disabled button, negative tabindex div, hidden button
      expect(focusableElements).toHaveLength(4);
      
      document.body.removeChild(container);
    });

    test('returns empty array for container with no focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div>Not focusable</div>
        <span>Also not focusable</span>
      `;
      
      const focusableElements = getFocusableElements(container);
      expect(focusableElements).toHaveLength(0);
    });

    test('returns empty array for null container', () => {
      const focusableElements = getFocusableElements(null);
      expect(focusableElements).toHaveLength(0);
    });
  });

  describe('trapFocus', () => {
    test('traps focus within container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="second">Second</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);
      
      const firstButton = container.querySelector('#first');
      const lastButton = container.querySelector('#last');
      
      // Focus first button
      firstButton.focus();
      
      // Simulate Shift+Tab (should prevent default and focus last button)
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      
      trapFocus(container, shiftTabEvent);
      expect(shiftTabEvent.defaultPrevented).toBe(true);
      
      // Focus last button
      lastButton.focus();
      
      // Simulate Tab (should prevent default and focus first button)
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true,
        cancelable: true
      });
      
      trapFocus(container, tabEvent);
      expect(tabEvent.defaultPrevented).toBe(true);
      
      document.body.removeChild(container);
    });

    test('does nothing for non-Tab keys', () => {
      const container = document.createElement('div');
      container.innerHTML = '<button>Button</button>';
      document.body.appendChild(container);
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      
      trapFocus(container, enterEvent);
      expect(enterEvent.defaultPrevented).toBe(false);
      
      document.body.removeChild(container);
    });
  });

  describe('handleArrowNavigation', () => {
    test('handles vertical arrow navigation', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
        <button id="btn3">Button 3</button>
      `;
      document.body.appendChild(container);
      
      const buttons = container.querySelectorAll('button');
      buttons[0].focus();
      
      // Simulate ArrowDown
      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true
      });
      
      handleArrowNavigation(container, downEvent);
      expect(downEvent.defaultPrevented).toBe(true);
      
      document.body.removeChild(container);
    });

    test('handles horizontal arrow navigation', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
        <button id="btn3">Button 3</button>
      `;
      document.body.appendChild(container);
      
      const buttons = container.querySelectorAll('button');
      buttons[0].focus();
      
      // Simulate ArrowRight with horizontal orientation
      const rightEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true
      });
      
      handleArrowNavigation(container, rightEvent, { orientation: 'horizontal' });
      expect(rightEvent.defaultPrevented).toBe(true);
      
      document.body.removeChild(container);
    });

    test('handles Home and End keys', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
        <button id="btn3">Button 3</button>
      `;
      document.body.appendChild(container);
      
      const buttons = container.querySelectorAll('button');
      buttons[1].focus(); // Focus middle button
      
      // Simulate Home key
      const homeEvent = new KeyboardEvent('keydown', {
        key: 'Home',
        bubbles: true,
        cancelable: true
      });
      
      handleArrowNavigation(container, homeEvent);
      expect(homeEvent.defaultPrevented).toBe(true);
      
      // Simulate End key
      const endEvent = new KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
        cancelable: true
      });
      
      handleArrowNavigation(container, endEvent);
      expect(endEvent.defaultPrevented).toBe(true);
      
      document.body.removeChild(container);
    });
  });

  describe('RovingTabIndex', () => {
    test('initializes with correct tabindex values', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
        <button>Button 3</button>
      `;
      document.body.appendChild(container);
      
      const rovingTabIndex = new RovingTabIndex(container);
      const buttons = container.querySelectorAll('button');
      
      expect(buttons[0].tabIndex).toBe(0);
      expect(buttons[1].tabIndex).toBe(-1);
      expect(buttons[2].tabIndex).toBe(-1);
      
      rovingTabIndex.destroy();
      document.body.removeChild(container);
    });

    test('updates current index correctly', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
        <button>Button 3</button>
      `;
      document.body.appendChild(container);
      
      const rovingTabIndex = new RovingTabIndex(container);
      const buttons = container.querySelectorAll('button');
      
      rovingTabIndex.setCurrentIndex(1);
      
      expect(buttons[0].tabIndex).toBe(-1);
      expect(buttons[1].tabIndex).toBe(0);
      expect(buttons[2].tabIndex).toBe(-1);
      
      rovingTabIndex.destroy();
      document.body.removeChild(container);
    });
  });

  describe('announceToScreenReader', () => {
    test('creates live region with message', () => {
      announceToScreenReader('Test announcement');
      
      const announcer = document.querySelector('[aria-live="polite"]');
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveTextContent('Test announcement');
      expect(announcer).toHaveClass('sr-only');
      
      // Wait for cleanup
      setTimeout(() => {
        expect(document.querySelector('[aria-live="polite"]')).not.toBeInTheDocument();
      }, 1100);
    });

    test('supports different priority levels', () => {
      announceToScreenReader('Urgent message', 'assertive');
      
      const announcer = document.querySelector('[aria-live="assertive"]');
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveTextContent('Urgent message');
    });
  });

  describe('createSkipLink', () => {
    test('creates skip link with correct attributes', () => {
      const target = document.createElement('main');
      target.id = 'main-content';
      document.body.appendChild(target);
      
      const skipLink = createSkipLink('main-content', 'Skip to main');
      
      expect(skipLink.tagName).toBe('A');
      expect(skipLink.href).toContain('#main-content');
      expect(skipLink.textContent).toBe('Skip to main');
      expect(skipLink.className).toBe('skip-link');
      
      document.body.removeChild(target);
    });

    test('focuses target when clicked', () => {
      const target = document.createElement('main');
      target.id = 'main-content';
      target.tabIndex = -1;
      document.body.appendChild(target);
      
      const skipLink = createSkipLink('main-content');
      document.body.appendChild(skipLink);
      
      // Mock scrollIntoView
      target.scrollIntoView = jest.fn();
      
      skipLink.click();
      
      expect(document.activeElement).toBe(target);
      expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
      
      document.body.removeChild(target);
      document.body.removeChild(skipLink);
    });
  });

  describe('FocusManager', () => {
    test('saves and restores focus', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);
      
      const manager = new FocusManager();
      
      button.focus();
      manager.saveFocus();
      
      // Focus something else
      document.body.focus();
      
      // Restore focus
      const restored = manager.restoreFocus();
      expect(restored).toBe(true);
      expect(document.activeElement).toBe(button);
      
      document.body.removeChild(button);
    });

    test('focuses first element in container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="second">Second</button>
      `;
      document.body.appendChild(container);
      
      const manager = new FocusManager();
      const result = manager.focusFirstIn(container);
      
      expect(result).toBe(true);
      expect(document.activeElement.id).toBe('first');
      
      document.body.removeChild(container);
    });

    test('focuses last element in container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);
      
      const manager = new FocusManager();
      const result = manager.focusLastIn(container);
      
      expect(result).toBe(true);
      expect(document.activeElement.id).toBe('last');
      
      document.body.removeChild(container);
    });

    test('returns false when no focusable elements found', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div>No focusable elements</div>';
      document.body.appendChild(container);
      
      const manager = new FocusManager();
      const result = manager.focusFirstIn(container);
      
      expect(result).toBe(false);
      
      document.body.removeChild(container);
    });
  });

  describe('Global focusManager', () => {
    test('is an instance of FocusManager', () => {
      expect(focusManager).toBeInstanceOf(FocusManager);
    });
  });
});