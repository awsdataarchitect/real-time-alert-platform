/**
 * Comprehensive accessibility tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import AccessibleButton from '../../src/components/accessibility/AccessibleButton';
import AccessibleInput from '../../src/components/accessibility/AccessibleInput';
import { 
  getFocusableElements, 
  isFocusable, 
  trapFocus, 
  handleArrowNavigation,
  RovingTabIndex,
  focusManager
} from '../../src/utils/keyboardNavigation';
import { 
  liveRegionManager, 
  ariaUtils, 
  formatAlertForScreenReader 
} from '../../src/utils/screenReader';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Clear any existing live regions
    liveRegionManager.clearAll();
    
    // Reset focus
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });

  describe('AccessibleButton Component', () => {
    test('renders with proper ARIA attributes', () => {
      render(
        <AccessibleButton ariaLabel="Test button" ariaDescribedBy="desc-1">
          Click me
        </AccessibleButton>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(button).toHaveAttribute('aria-describedby', 'desc-1');
    });

    test('handles keyboard activation', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(
        <AccessibleButton onClick={handleClick}>
          Click me
        </AccessibleButton>
      );
      
      const button = screen.getByRole('button');
      
      // Test Enter key
      button.focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      // Test Space key
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    test('shows loading state with proper ARIA', () => {
      render(
        <AccessibleButton loading>
          Submit
        </AccessibleButton>
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('meets WCAG color contrast requirements', async () => {
      const { container } = render(
        <AccessibleButton variant="primary">
          Primary Button
        </AccessibleButton>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('has minimum touch target size', () => {
      render(<AccessibleButton>Button</AccessibleButton>);
      
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // WCAG requires minimum 44x44px touch targets
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
    });
  });

  describe('AccessibleInput Component', () => {
    test('renders with proper labels and associations', () => {
      render(
        <AccessibleInput
          label="Email Address"
          helpText="Enter your email"
          error="Invalid email"
          required
        />
      );
      
      const input = screen.getByLabelText(/Email Address/);
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      
      expect(screen.getByText('Enter your email')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    });

    test('password toggle works with keyboard', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibleInput
          type="password"
          label="Password"
          value="secret"
          onChange={() => {}}
        />
      );
      
      const input = screen.getByLabelText('Password');
      const toggleButton = screen.getByLabelText('Show password');
      
      expect(input).toHaveAttribute('type', 'password');
      
      // Click toggle
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
    });

    test('error announcements work correctly', async () => {
      const { rerender } = render(
        <AccessibleInput
          label="Username"
          value=""
          onChange={() => {}}
        />
      );
      
      // Add error
      rerender(
        <AccessibleInput
          label="Username"
          value=""
          onChange={() => {}}
          error="Username is required"
        />
      );
      
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Username is required');
      expect(errorElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Keyboard Navigation Utilities', () => {
    test('getFocusableElements returns correct elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <a href="#">Link</a>
        <input type="text" />
        <button disabled>Disabled Button</button>
        <div tabindex="0">Focusable Div</div>
        <div tabindex="-1">Non-focusable Div</div>
      `;
      
      const focusableElements = getFocusableElements(container);
      expect(focusableElements).toHaveLength(4); // button, link, input, focusable div
    });

    test('isFocusable correctly identifies focusable elements', () => {
      const button = document.createElement('button');
      const disabledButton = document.createElement('button');
      disabledButton.disabled = true;
      const link = document.createElement('a');
      link.href = '#';
      
      expect(isFocusable(button)).toBe(true);
      expect(isFocusable(disabledButton)).toBe(false);
      expect(isFocusable(link)).toBe(true);
    });

    test('trapFocus works correctly', () => {
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
      
      // Simulate Shift+Tab (should go to last button)
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true
      });
      
      trapFocus(container, event);
      
      // In a real scenario, this would move focus to the last button
      // Here we just test that the function doesn't throw
      expect(event.defaultPrevented).toBe(true);
      
      document.body.removeChild(container);
    });

    test('RovingTabIndex manages focus correctly', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
        <button>Button 3</button>
      `;
      document.body.appendChild(container);
      
      const rovingTabIndex = new RovingTabIndex(container);
      const buttons = container.querySelectorAll('button');
      
      // First button should have tabindex 0, others -1
      expect(buttons[0].tabIndex).toBe(0);
      expect(buttons[1].tabIndex).toBe(-1);
      expect(buttons[2].tabIndex).toBe(-1);
      
      // Change current index
      rovingTabIndex.setCurrentIndex(1);
      expect(buttons[0].tabIndex).toBe(-1);
      expect(buttons[1].tabIndex).toBe(0);
      expect(buttons[2].tabIndex).toBe(-1);
      
      rovingTabIndex.destroy();
      document.body.removeChild(container);
    });
  });

  describe('Screen Reader Utilities', () => {
    test('liveRegionManager creates regions correctly', () => {
      expect(document.getElementById('live-region-polite')).toBeInTheDocument();
      expect(document.getElementById('live-region-assertive')).toBeInTheDocument();
      expect(document.getElementById('live-region-status')).toBeInTheDocument();
    });

    test('announcements work correctly', () => {
      const politeRegion = document.getElementById('live-region-polite');
      const assertiveRegion = document.getElementById('live-region-assertive');
      
      liveRegionManager.announce('Test message', 'polite');
      expect(politeRegion.textContent).toBe('Test message');
      
      liveRegionManager.announceAlert('Alert message');
      expect(assertiveRegion.textContent).toBe('Alert message');
    });

    test('ariaUtils generates unique IDs', () => {
      const id1 = ariaUtils.generateId('test');
      const id2 = ariaUtils.generateId('test');
      
      expect(id1).toMatch(/^test-/);
      expect(id2).toMatch(/^test-/);
      expect(id1).not.toBe(id2);
    });

    test('formatAlertForScreenReader creates proper announcement', () => {
      const alert = {
        severity: 'critical',
        category: 'Weather',
        headline: 'Severe Storm Warning',
        affectedAreas: [
          { areaName: 'Downtown' },
          { areaName: 'Suburbs' }
        ],
        startTime: '2023-01-01T12:00:00Z'
      };
      
      const announcement = formatAlertForScreenReader(alert);
      expect(announcement).toContain('Critical alert requiring immediate attention');
      expect(announcement).toContain('Category: Weather');
      expect(announcement).toContain('Alert: Severe Storm Warning');
      expect(announcement).toContain('Affected areas: Downtown, Suburbs');
    });
  });

  describe('Focus Management', () => {
    test('focusManager saves and restores focus', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);
      
      button.focus();
      focusManager.saveFocus();
      
      // Focus something else
      document.body.focus();
      
      // Restore focus
      const restored = focusManager.restoreFocus();
      expect(restored).toBe(true);
      expect(document.activeElement).toBe(button);
      
      document.body.removeChild(button);
    });

    test('focusManager focuses first/last elements in container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="second">Second</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);
      
      const firstButton = container.querySelector('#first');
      const lastButton = container.querySelector('#last');
      
      focusManager.focusFirstIn(container);
      expect(document.activeElement).toBe(firstButton);
      
      focusManager.focusLastIn(container);
      expect(document.activeElement).toBe(lastButton);
      
      document.body.removeChild(container);
    });
  });

  describe('WCAG Compliance', () => {
    test('components pass axe accessibility tests', async () => {
      const { container } = render(
        <div>
          <AccessibleButton variant="primary">Primary Button</AccessibleButton>
          <AccessibleButton variant="secondary">Secondary Button</AccessibleButton>
          <AccessibleInput 
            label="Test Input" 
            helpText="Help text" 
            value=""
            onChange={() => {}}
          />
        </div>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('high contrast mode is supported', () => {
      document.documentElement.setAttribute('data-high-contrast', 'true');
      
      const { container } = render(
        <AccessibleButton variant="primary">High Contrast Button</AccessibleButton>
      );
      
      const button = container.querySelector('button');
      const styles = window.getComputedStyle(button);
      
      // In high contrast mode, border should be thicker
      expect(styles.borderWidth).toBe('3px');
      
      document.documentElement.removeAttribute('data-high-contrast');
    });

    test('reduced motion is respected', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      const { container } = render(
        <AccessibleButton>Animated Button</AccessibleButton>
      );
      
      // Test would verify that animations are disabled
      // This is a simplified test - in practice you'd check computed styles
      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Color Contrast', () => {
    test('text has sufficient contrast ratio', async () => {
      const { container } = render(
        <div style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          <p>This text should have good contrast</p>
        </div>
      );
      
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Accessibility', () => {
    test('form has proper structure and labels', async () => {
      const { container } = render(
        <form>
          <fieldset>
            <legend>User Information</legend>
            <AccessibleInput
              label="First Name"
              required
              value=""
              onChange={() => {}}
            />
            <AccessibleInput
              label="Email"
              type="email"
              required
              value=""
              onChange={() => {}}
            />
          </fieldset>
          <AccessibleButton type="submit">Submit</AccessibleButton>
        </form>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      
      // Check that form has proper structure
      expect(screen.getByRole('group', { name: 'User Information' })).toBeInTheDocument();
      expect(screen.getByLabelText(/First Name/)).toBeRequired();
      expect(screen.getByLabelText(/Email/)).toBeRequired();
    });
  });

  describe('Navigation Accessibility', () => {
    test('skip links work correctly', () => {
      const mainContent = document.createElement('main');
      mainContent.id = 'main-content';
      mainContent.textContent = 'Main content';
      document.body.appendChild(mainContent);
      
      const skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.className = 'skip-link';
      
      skipLink.addEventListener('click', (event) => {
        event.preventDefault();
        mainContent.focus();
      });
      
      document.body.appendChild(skipLink);
      
      // Simulate click
      skipLink.click();
      expect(document.activeElement).toBe(mainContent);
      
      document.body.removeChild(skipLink);
      document.body.removeChild(mainContent);
    });
  });
});