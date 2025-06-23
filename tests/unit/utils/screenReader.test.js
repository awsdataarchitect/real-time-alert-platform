import {
  LiveRegionManager,
  ariaUtils,
  getAccessibleSeverityText,
  formatAlertForScreenReader,
  progressUtils,
  formUtils,
  navigationUtils,
  loadingUtils,
  tableUtils,
  liveRegionManager,
  isScreenReaderActive,
  focusUtils
} from '../../../src/utils/screenReader';

describe('Screen Reader Utilities', () => {
  beforeEach(() => {
    // Clear document body
    document.body.innerHTML = '';
    
    // Clear live regions
    if (liveRegionManager) {
      liveRegionManager.clearAll();
    }
  });

  describe('LiveRegionManager', () => {
    test('creates default live regions on initialization', () => {
      const manager = new LiveRegionManager();
      
      expect(document.getElementById('live-region-polite')).toBeInTheDocument();
      expect(document.getElementById('live-region-assertive')).toBeInTheDocument();
      expect(document.getElementById('live-region-status')).toBeInTheDocument();
      
      const politeRegion = document.getElementById('live-region-polite');
      expect(politeRegion).toHaveAttribute('aria-live', 'polite');
      expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
      expect(politeRegion).toHaveClass('sr-only');
    });

    test('creates custom live regions', () => {
      const manager = new LiveRegionManager();
      const customRegion = manager.createRegion('custom', 'assertive', 'alert');
      
      expect(customRegion.id).toBe('live-region-custom');
      expect(customRegion).toHaveAttribute('aria-live', 'assertive');
      expect(customRegion).toHaveAttribute('role', 'alert');
    });

    test('announces messages correctly', () => {
      const manager = new LiveRegionManager();
      
      manager.announce('Test message', 'polite');
      const politeRegion = document.getElementById('live-region-polite');
      expect(politeRegion.textContent).toBe('Test message');
      
      manager.announceAlert('Alert message');
      const assertiveRegion = document.getElementById('live-region-assertive');
      expect(assertiveRegion.textContent).toBe('Alert message');
      
      manager.announceStatus('Status message');
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Status message');
    });

    test('clears regions correctly', () => {
      const manager = new LiveRegionManager();
      
      manager.announce('Test message', 'polite');
      manager.clear('polite');
      
      const politeRegion = document.getElementById('live-region-polite');
      expect(politeRegion.textContent).toBe('');
    });

    test('clears all regions', () => {
      const manager = new LiveRegionManager();
      
      manager.announce('Message 1', 'polite');
      manager.announce('Message 2', 'assertive');
      manager.clearAll();
      
      const politeRegion = document.getElementById('live-region-polite');
      const assertiveRegion = document.getElementById('live-region-assertive');
      
      expect(politeRegion.textContent).toBe('');
      expect(assertiveRegion.textContent).toBe('');
    });
  });

  describe('ariaUtils', () => {
    test('generates unique IDs', () => {
      const id1 = ariaUtils.generateId('test');
      const id2 = ariaUtils.generateId('test');
      
      expect(id1).toMatch(/^test-/);
      expect(id2).toMatch(/^test-/);
      expect(id1).not.toBe(id2);
    });

    test('sets up labelledby relationship', () => {
      const element = document.createElement('input');
      const label = document.createElement('label');
      label.textContent = 'Test Label';
      
      ariaUtils.labelledBy(element, label);
      
      expect(label.id).toBeTruthy();
      expect(element).toHaveAttribute('aria-labelledby', label.id);
    });

    test('sets up describedby relationship', () => {
      const element = document.createElement('input');
      const description = document.createElement('div');
      description.textContent = 'Description';
      
      ariaUtils.describedBy(element, description);
      
      expect(description.id).toBeTruthy();
      expect(element).toHaveAttribute('aria-describedby', description.id);
    });

    test('combines multiple describedby relationships', () => {
      const element = document.createElement('input');
      const desc1 = document.createElement('div');
      const desc2 = document.createElement('div');
      
      desc1.id = 'desc1';
      desc2.id = 'desc2';
      
      element.setAttribute('aria-describedby', 'desc1');
      ariaUtils.describedBy(element, desc2);
      
      expect(element).toHaveAttribute('aria-describedby', 'desc1 desc2');
    });

    test('creates accessible name with all options', () => {
      const element = document.createElement('button');
      
      ariaUtils.createAccessibleName(element, {
        label: 'Test Button',
        role: 'button',
        expanded: true,
        pressed: false,
        selected: true,
        checked: false
      });
      
      expect(element).toHaveAttribute('aria-label', 'Test Button');
      expect(element).toHaveAttribute('role', 'button');
      expect(element).toHaveAttribute('aria-expanded', 'true');
      expect(element).toHaveAttribute('aria-pressed', 'false');
      expect(element).toHaveAttribute('aria-selected', 'true');
      expect(element).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('getAccessibleSeverityText', () => {
    test('returns correct text for known severities', () => {
      expect(getAccessibleSeverityText('critical')).toBe('Critical alert requiring immediate attention');
      expect(getAccessibleSeverityText('high')).toBe('High priority alert');
      expect(getAccessibleSeverityText('medium')).toBe('Medium priority alert');
      expect(getAccessibleSeverityText('low')).toBe('Low priority alert');
      expect(getAccessibleSeverityText('info')).toBe('Informational alert');
    });

    test('returns generic text for unknown severities', () => {
      expect(getAccessibleSeverityText('unknown')).toBe('unknown priority alert');
    });
  });

  describe('formatAlertForScreenReader', () => {
    test('formats complete alert correctly', () => {
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
      
      const formatted = formatAlertForScreenReader(alert);
      
      expect(formatted).toContain('Critical alert requiring immediate attention');
      expect(formatted).toContain('Category: Weather');
      expect(formatted).toContain('Alert: Severe Storm Warning');
      expect(formatted).toContain('Affected areas: Downtown, Suburbs');
      expect(formatted).toContain('Start time:');
      expect(formatted.endsWith('.')).toBe(true);
    });

    test('handles minimal alert data', () => {
      const alert = {
        severity: 'low',
        headline: 'Test Alert'
      };
      
      const formatted = formatAlertForScreenReader(alert);
      
      expect(formatted).toContain('Low priority alert');
      expect(formatted).toContain('Alert: Test Alert');
    });
  });

  describe('progressUtils', () => {
    test('announces progress correctly', () => {
      const manager = new LiveRegionManager();
      
      progressUtils.announceProgress(3, 10, 'Upload');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toContain('Upload: 3 of 10, 30 percent complete');
    });

    test('announces completion', () => {
      const manager = new LiveRegionManager();
      
      progressUtils.announceCompletion('Upload');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Upload completed successfully');
    });

    test('announces errors', () => {
      const manager = new LiveRegionManager();
      
      progressUtils.announceError('Network timeout', 'Upload');
      
      const assertiveRegion = document.getElementById('live-region-assertive');
      expect(assertiveRegion.textContent).toBe('Error in Upload: Network timeout');
    });
  });

  describe('formUtils', () => {
    test('announces validation errors', () => {
      const manager = new LiveRegionManager();
      
      formUtils.announceValidationError('Email', 'Invalid format');
      
      const assertiveRegion = document.getElementById('live-region-assertive');
      expect(assertiveRegion.textContent).toBe('Email: Invalid format');
    });

    test('announces validation success', () => {
      const manager = new LiveRegionManager();
      
      formUtils.announceValidationSuccess('Password');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Password is valid');
    });

    test('announces form submission', () => {
      const manager = new LiveRegionManager();
      
      formUtils.announceFormSubmission(true);
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Form is being submitted, please wait');
      
      formUtils.announceFormSubmission(false);
      expect(statusRegion.textContent).toBe('Form submitted successfully');
    });
  });

  describe('navigationUtils', () => {
    test('announces page changes', () => {
      const manager = new LiveRegionManager();
      
      navigationUtils.announcePageChange('Dashboard');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Navigated to Dashboard');
    });

    test('announces modal operations', () => {
      const manager = new LiveRegionManager();
      
      navigationUtils.announceModalOpen('Settings');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Settings dialog opened');
      
      navigationUtils.announceModalClose();
      expect(statusRegion.textContent).toBe('Dialog closed');
    });

    test('announces menu operations', () => {
      const manager = new LiveRegionManager();
      
      navigationUtils.announceMenuOpen('Navigation');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Navigation menu opened');
      
      navigationUtils.announceMenuClose();
      expect(statusRegion.textContent).toBe('Menu closed');
    });
  });

  describe('loadingUtils', () => {
    test('announces loading states', () => {
      const manager = new LiveRegionManager();
      
      loadingUtils.announceLoadingStart('alerts');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Loading alerts, please wait');
      
      loadingUtils.announceLoadingComplete('alerts');
      expect(statusRegion.textContent).toBe('alerts loaded successfully');
    });

    test('announces loading errors', () => {
      const manager = new LiveRegionManager();
      
      loadingUtils.announceLoadingError('data', 'Network error');
      
      const assertiveRegion = document.getElementById('live-region-assertive');
      expect(assertiveRegion.textContent).toBe('Failed to load data: Network error');
    });

    test('announces data updates', () => {
      const manager = new LiveRegionManager();
      
      loadingUtils.announceDataUpdate(5, 'alerts');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('5 alerts updated');
    });
  });

  describe('tableUtils', () => {
    test('announces table operations', () => {
      const manager = new LiveRegionManager();
      
      tableUtils.announceTableSort('Name', 'ascending');
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Table sorted by Name, ascending');
      
      tableUtils.announceTableFilter(10, 50);
      expect(statusRegion.textContent).toBe('Showing 10 of 50 items');
      
      tableUtils.announceSelection(3, 10, 'alerts');
      expect(statusRegion.textContent).toBe('3 of 10 alerts selected');
    });
  });

  describe('isScreenReaderActive', () => {
    test('returns boolean value', () => {
      const result = isScreenReaderActive();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('focusUtils', () => {
    test('announces focus changes', () => {
      const manager = new LiveRegionManager();
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Test Button');
      
      focusUtils.announceFocus(button);
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toContain('Focused on button: Test Button');
    });

    test('announces expanded state changes', () => {
      const manager = new LiveRegionManager();
      const button = document.createElement('button');
      button.textContent = 'Menu';
      
      focusUtils.announceExpanded(button, true);
      
      const statusRegion = document.getElementById('live-region-status');
      expect(statusRegion.textContent).toBe('Menu expanded');
      
      focusUtils.announceExpanded(button, false);
      expect(statusRegion.textContent).toBe('Menu collapsed');
    });
  });

  describe('Global liveRegionManager', () => {
    test('is an instance of LiveRegionManager', () => {
      expect(liveRegionManager).toBeInstanceOf(LiveRegionManager);
    });

    test('has default regions available', () => {
      expect(document.getElementById('live-region-polite')).toBeInTheDocument();
      expect(document.getElementById('live-region-assertive')).toBeInTheDocument();
      expect(document.getElementById('live-region-status')).toBeInTheDocument();
    });
  });
});