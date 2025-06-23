import React, { useState } from 'react';
import { useFilter } from '../../context/FilterContext';

const FilterPanel = () => {
  const {
    filters,
    updateFilter,
    clearFilters,
    sortField,
    sortDirection,
    updateSort,
    loading,
    availableCategories,
    availableSeverities,
    availableSourceTypes,
    availableEventTypes
  } = useFilter();

  const [isExpanded, setIsExpanded] = useState(false);

  const handleSortChange = (e) => {
    const [field, direction] = e.target.value.split('-');
    updateSort(field, direction);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const sortOptions = [
    { value: 'createdAt-DESC', label: 'Newest First' },
    { value: 'createdAt-ASC', label: 'Oldest First' },
    { value: 'severity-DESC', label: 'Highest Severity' },
    { value: 'severity-ASC', label: 'Lowest Severity' },
    { value: 'startTime-DESC', label: 'Latest Start Time' },
    { value: 'startTime-ASC', label: 'Earliest Start Time' }
  ];

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>Filter Alerts</h3>
        <button 
          className="toggle-button"
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          aria-controls="filter-controls"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div 
        id="filter-controls"
        className={`filter-panel-content ${isExpanded ? 'expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        {/* Search */}
        <div className="filter-section">
          <label htmlFor="search-filter">Search:</label>
          <input
            id="search-filter"
            type="text"
            value={filters.searchText || ''}
            onChange={(e) => updateFilter('searchText', e.target.value)}
            placeholder="Search in headlines and descriptions"
            disabled={loading}
          />
        </div>

        {/* Category Filter */}
        <div className="filter-section">
          <label htmlFor="category-filter">Category:</label>
          <select
            id="category-filter"
            value={filters.category || ''}
            onChange={(e) => updateFilter('category', e.target.value || null)}
            disabled={loading}
          >
            <option value="">All Categories</option>
            {availableCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div className="filter-section">
          <label htmlFor="severity-filter">Severity:</label>
          <select
            id="severity-filter"
            value={filters.severity || ''}
            onChange={(e) => updateFilter('severity', e.target.value || null)}
            disabled={loading}
          >
            <option value="">All Severities</option>
            {availableSeverities.map(severity => (
              <option key={severity} value={severity}>{severity}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-section">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={filters.status || ''}
            onChange={(e) => updateFilter('status', e.target.value || null)}
            disabled={loading}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="TEST">Test</option>
          </select>
        </div>

        {/* Source Type Filter */}
        <div className="filter-section">
          <label htmlFor="source-filter">Source:</label>
          <select
            id="source-filter"
            value={filters.sourceType || ''}
            onChange={(e) => updateFilter('sourceType', e.target.value || null)}
            disabled={loading}
          >
            <option value="">All Sources</option>
            {availableSourceTypes.map(sourceType => (
              <option key={sourceType} value={sourceType}>{sourceType}</option>
            ))}
          </select>
        </div>

        {/* Event Type Filter */}
        <div className="filter-section">
          <label htmlFor="event-filter">Event Type:</label>
          <select
            id="event-filter"
            value={filters.eventType || ''}
            onChange={(e) => updateFilter('eventType', e.target.value || null)}
            disabled={loading}
          >
            <option value="">All Event Types</option>
            {availableEventTypes.map(eventType => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="filter-section">
          <label htmlFor="start-date">From:</label>
          <input
            id="start-date"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => updateFilter('startDate', e.target.value || null)}
            disabled={loading}
          />
          
          <label htmlFor="end-date">To:</label>
          <input
            id="end-date"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => updateFilter('endDate', e.target.value || null)}
            disabled={loading}
          />
        </div>

        {/* Sort Options */}
        <div className="filter-section">
          <label htmlFor="sort-options">Sort By:</label>
          <select
            id="sort-options"
            value={`${sortField}-${sortDirection}`}
            onChange={handleSortChange}
            disabled={loading}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="filter-actions">
          <button
            onClick={clearFilters}
            disabled={loading}
            className="clear-filters-button"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;