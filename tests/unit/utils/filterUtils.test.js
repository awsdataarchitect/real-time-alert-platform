import {
  filterAlerts,
  sortAlerts,
  paginateAlerts,
  getUniqueValues,
  createFilterInput
} from '../../../src/utils/filterUtils';

describe('filterUtils', () => {
  // Sample alerts for testing
  const sampleAlerts = [
    {
      id: '1',
      headline: 'Severe Thunderstorm Warning',
      description: 'A severe thunderstorm is approaching the area',
      severity: 'SEVERE',
      category: 'WEATHER',
      status: 'ACTIVE',
      sourceType: 'NOAA',
      eventType: 'THUNDERSTORM',
      startTime: '2025-06-20T10:00:00Z',
      createdAt: '2025-06-20T09:45:00Z'
    },
    {
      id: '2',
      headline: 'Flash Flood Warning',
      description: 'Flash flooding is occurring in the area',
      severity: 'EXTREME',
      category: 'FLOOD',
      status: 'ACTIVE',
      sourceType: 'NOAA',
      eventType: 'FLOOD',
      startTime: '2025-06-20T11:30:00Z',
      createdAt: '2025-06-20T11:15:00Z'
    },
    {
      id: '3',
      headline: 'Earthquake Report',
      description: 'A 4.5 magnitude earthquake has been detected',
      severity: 'MODERATE',
      category: 'EARTHQUAKE',
      status: 'ACTIVE',
      sourceType: 'USGS',
      eventType: 'EARTHQUAKE',
      startTime: '2025-06-19T22:15:00Z',
      createdAt: '2025-06-19T22:20:00Z'
    },
    {
      id: '4',
      headline: 'Air Quality Alert',
      description: 'Air quality has reached unhealthy levels',
      severity: 'MINOR',
      category: 'HEALTH',
      status: 'ACTIVE',
      sourceType: 'EPA',
      eventType: 'AIR_QUALITY',
      startTime: '2025-06-18T08:00:00Z',
      createdAt: '2025-06-18T07:45:00Z'
    },
    {
      id: '5',
      headline: 'Test Emergency Alert',
      description: 'This is a test of the emergency alert system',
      severity: 'MINOR',
      category: 'OTHER',
      status: 'TEST',
      sourceType: 'SYSTEM',
      eventType: 'TEST',
      startTime: '2025-06-21T14:00:00Z',
      createdAt: '2025-06-21T13:55:00Z'
    }
  ];

  describe('filterAlerts', () => {
    test('should return empty array for null or non-array input', () => {
      expect(filterAlerts(null)).toEqual([]);
      expect(filterAlerts('not an array')).toEqual([]);
      expect(filterAlerts({})).toEqual([]);
    });

    test('should return all alerts when no filters are provided', () => {
      expect(filterAlerts(sampleAlerts)).toEqual(sampleAlerts);
    });

    test('should filter by category', () => {
      const filtered = filterAlerts(sampleAlerts, { category: 'WEATHER' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    test('should filter by severity', () => {
      const filtered = filterAlerts(sampleAlerts, { severity: 'EXTREME' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    test('should filter by status', () => {
      const filtered = filterAlerts(sampleAlerts, { status: 'TEST' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('5');
    });

    test('should filter by sourceType', () => {
      const filtered = filterAlerts(sampleAlerts, { sourceType: 'USGS' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    test('should filter by eventType', () => {
      const filtered = filterAlerts(sampleAlerts, { eventType: 'AIR_QUALITY' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('4');
    });

    test('should filter by date range', () => {
      const filtered = filterAlerts(sampleAlerts, {
        startDate: '2025-06-19T00:00:00Z',
        endDate: '2025-06-20T12:00:00Z'
      });
      expect(filtered).toHaveLength(3);
      expect(filtered.map(a => a.id)).toContain('1');
      expect(filtered.map(a => a.id)).toContain('2');
      expect(filtered.map(a => a.id)).toContain('3');
    });

    test('should filter by search text in headline', () => {
      const filtered = filterAlerts(sampleAlerts, { searchText: 'earthquake' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    test('should filter by search text in description', () => {
      const filtered = filterAlerts(sampleAlerts, { searchText: 'unhealthy' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('4');
    });

    test('should apply multiple filters', () => {
      const filtered = filterAlerts(sampleAlerts, {
        category: 'WEATHER',
        severity: 'SEVERE',
        status: 'ACTIVE'
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });
  });

  describe('sortAlerts', () => {
    test('should return empty array for null or non-array input', () => {
      expect(sortAlerts(null)).toEqual([]);
      expect(sortAlerts('not an array')).toEqual([]);
      expect(sortAlerts({})).toEqual([]);
    });

    test('should sort by createdAt DESC by default', () => {
      const sorted = sortAlerts(sampleAlerts);
      expect(sorted[0].id).toBe('5'); // Most recent first
      expect(sorted[4].id).toBe('4'); // Oldest last
    });

    test('should sort by createdAt ASC', () => {
      const sorted = sortAlerts(sampleAlerts, 'createdAt', 'ASC');
      expect(sorted[0].id).toBe('4'); // Oldest first
      expect(sorted[4].id).toBe('5'); // Most recent last
    });

    test('should sort by severity DESC', () => {
      const sorted = sortAlerts(sampleAlerts, 'severity', 'DESC');
      // EXTREME > SEVERE > MODERATE > MINOR
      expect(sorted[0].id).toBe('2'); // EXTREME
      expect(sorted[1].id).toBe('1'); // SEVERE
      expect(sorted[2].id).toBe('3'); // MODERATE
      // The last two are both MINOR, so their order depends on the stable sort
    });

    test('should sort by category ASC', () => {
      const sorted = sortAlerts(sampleAlerts, 'category', 'ASC');
      // Alphabetical: EARTHQUAKE, FLOOD, HEALTH, OTHER, WEATHER
      expect(sorted[0].id).toBe('3'); // EARTHQUAKE
      expect(sorted[1].id).toBe('2'); // FLOOD
      expect(sorted[2].id).toBe('4'); // HEALTH
      expect(sorted[3].id).toBe('5'); // OTHER
      expect(sorted[4].id).toBe('1'); // WEATHER
    });

    test('should handle null or undefined values', () => {
      const alertsWithNulls = [
        { id: '1', severity: 'SEVERE', createdAt: '2025-06-20T09:45:00Z' },
        { id: '2', severity: null, createdAt: '2025-06-20T11:15:00Z' },
        { id: '3', severity: undefined, createdAt: '2025-06-19T22:20:00Z' }
      ];
      
      const sorted = sortAlerts(alertsWithNulls, 'severity', 'DESC');
      expect(sorted[0].id).toBe('1'); // SEVERE
      // Null and undefined should be at the end for DESC
    });
  });

  describe('paginateAlerts', () => {
    test('should return empty results for null or non-array input', () => {
      const result = paginateAlerts(null);
      expect(result.alerts).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
    });

    test('should paginate alerts correctly', () => {
      const result = paginateAlerts(sampleAlerts, 1, 2);
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].id).toBe('1');
      expect(result.alerts[1].id).toBe('2');
      expect(result.pagination.totalItems).toBe(5);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    test('should handle page out of range', () => {
      const result = paginateAlerts(sampleAlerts, 10, 2);
      expect(result.alerts).toHaveLength(0);
      expect(result.pagination.currentPage).toBe(3); // Clamped to max page
    });

    test('should handle last page with fewer items', () => {
      const result = paginateAlerts(sampleAlerts, 3, 2);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].id).toBe('5');
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });
  });

  describe('getUniqueValues', () => {
    test('should return empty array for null or non-array input', () => {
      expect(getUniqueValues(null, 'category')).toEqual([]);
      expect(getUniqueValues('not an array', 'category')).toEqual([]);
      expect(getUniqueValues({}, 'category')).toEqual([]);
    });

    test('should return empty array if field is not provided', () => {
      expect(getUniqueValues(sampleAlerts)).toEqual([]);
      expect(getUniqueValues(sampleAlerts, null)).toEqual([]);
      expect(getUniqueValues(sampleAlerts, '')).toEqual([]);
    });

    test('should return unique values for a field', () => {
      const categories = getUniqueValues(sampleAlerts, 'category');
      expect(categories).toHaveLength(5);
      expect(categories).toContain('WEATHER');
      expect(categories).toContain('FLOOD');
      expect(categories).toContain('EARTHQUAKE');
      expect(categories).toContain('HEALTH');
      expect(categories).toContain('OTHER');
    });

    test('should filter out null and undefined values', () => {
      const alertsWithNulls = [
        { id: '1', severity: 'SEVERE' },
        { id: '2', severity: null },
        { id: '3', severity: undefined },
        { id: '4', severity: 'MINOR' }
      ];
      
      const severities = getUniqueValues(alertsWithNulls, 'severity');
      expect(severities).toHaveLength(2);
      expect(severities).toContain('SEVERE');
      expect(severities).toContain('MINOR');
    });
  });

  describe('createFilterInput', () => {
    test('should return null when no filters are provided', () => {
      expect(createFilterInput()).toBeNull();
      expect(createFilterInput({})).toBeNull();
    });

    test('should create filter input for category', () => {
      const input = createFilterInput({ category: 'WEATHER' });
      expect(input).toEqual({ category: { eq: 'WEATHER' } });
    });

    test('should create filter input for severity', () => {
      const input = createFilterInput({ severity: 'SEVERE' });
      expect(input).toEqual({ severity: { eq: 'SEVERE' } });
    });

    test('should create filter input for status', () => {
      const input = createFilterInput({ status: 'ACTIVE' });
      expect(input).toEqual({ status: { eq: 'ACTIVE' } });
    });

    test('should create filter input for date range', () => {
      const input = createFilterInput({
        startDate: '2025-06-19T00:00:00Z',
        endDate: '2025-06-20T12:00:00Z'
      });
      expect(input).toEqual({
        startTimeFrom: '2025-06-19T00:00:00Z',
        startTimeTo: '2025-06-20T12:00:00Z'
      });
    });

    test('should create filter input for multiple filters', () => {
      const input = createFilterInput({
        category: 'WEATHER',
        severity: 'SEVERE',
        status: 'ACTIVE'
      });
      expect(input).toEqual({
        category: { eq: 'WEATHER' },
        severity: { eq: 'SEVERE' },
        status: { eq: 'ACTIVE' }
      });
    });
  });
});