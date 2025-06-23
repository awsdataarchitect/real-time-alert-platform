import React, { createContext, useContext, useState, useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { listAlerts, alertsByCategory, alertsBySeverity, alertsByStatus } from '../graphql/queries';
import { filterAlerts, sortAlerts, paginateAlerts, createFilterInput } from '../utils/filterUtils';
import { useMap } from './MapContext';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
  const { alerts: mapAlerts, setAlerts } = useMap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    category: null,
    severity: null,
    status: 'ACTIVE', // Default to active alerts
    sourceType: null,
    eventType: null,
    startDate: null,
    endDate: null,
    searchText: '',
  });
  
  // Sorting state
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('DESC');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 10,
    hasNextPage: false,
    hasPreviousPage: false
  });
  
  // Filtered and sorted alerts
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  
  // Available filter options
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSeverities, setAvailableSeverities] = useState([]);
  const [availableSourceTypes, setAvailableSourceTypes] = useState([]);
  const [availableEventTypes, setAvailableEventTypes] = useState([]);

  // Apply filters, sorting, and pagination to alerts
  useEffect(() => {
    const applyFiltersAndSort = async () => {
      try {
        setLoading(true);
        
        // If we have a category, severity, or status filter, use the specific query
        let response;
        if (filters.category) {
          response = await API.graphql(
            graphqlOperation(alertsByCategory, {
              category: filters.category,
              sortDirection: sortDirection,
              filter: createFilterInput(filters),
              limit: 100
            })
          );
          setFilteredAlerts(response.data.alertsByCategory.items);
        } else if (filters.severity) {
          response = await API.graphql(
            graphqlOperation(alertsBySeverity, {
              severity: filters.severity,
              sortDirection: sortDirection,
              filter: createFilterInput(filters),
              limit: 100
            })
          );
          setFilteredAlerts(response.data.alertsBySeverity.items);
        } else if (filters.status) {
          response = await API.graphql(
            graphqlOperation(alertsByStatus, {
              status: filters.status,
              sortDirection: sortDirection,
              filter: createFilterInput(filters),
              limit: 100
            })
          );
          setFilteredAlerts(response.data.alertsByStatus.items);
        } else {
          // Use the general list query
          response = await API.graphql(
            graphqlOperation(listAlerts, {
              filter: createFilterInput(filters),
              sortDirection: sortDirection,
              limit: 100
            })
          );
          setFilteredAlerts(response.data.listAlerts.items);
        }
        
        // Apply client-side filtering for search text
        let filtered = [...response.data.listAlerts.items];
        if (filters.searchText && filters.searchText.trim() !== '') {
          filtered = filterAlerts(filtered, { searchText: filters.searchText });
        }
        
        // Apply client-side sorting
        const sorted = sortAlerts(filtered, sortField, sortDirection);
        
        // Apply pagination
        const { alerts: paginatedAlerts, pagination } = paginateAlerts(sorted, page, pageSize);
        
        // Update state
        setFilteredAlerts(paginatedAlerts);
        setPaginationInfo(pagination);
        
        // Update map alerts if needed
        setAlerts(paginatedAlerts);
        
        // Extract available filter options
        setAvailableCategories([...new Set(response.data.listAlerts.items.map(a => a.category))]);
        setAvailableSeverities([...new Set(response.data.listAlerts.items.map(a => a.severity))]);
        setAvailableSourceTypes([...new Set(response.data.listAlerts.items.map(a => a.sourceType))]);
        setAvailableEventTypes([...new Set(response.data.listAlerts.items.map(a => a.eventType))]);
        
        setLoading(false);
      } catch (err) {
        console.error('Error applying filters:', err);
        setError(err);
        setLoading(false);
      }
    };

    applyFiltersAndSort();
  }, [filters, sortField, sortDirection, page, pageSize, setAlerts]);

  // Update filter
  const updateFilter = (filterName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value
    }));
    setPage(1); // Reset to first page when filter changes
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      category: null,
      severity: null,
      status: 'ACTIVE', // Keep default status filter
      sourceType: null,
      eventType: null,
      startDate: null,
      endDate: null,
      searchText: '',
    });
    setPage(1);
  };

  // Update sort
  const updateSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Pagination controls
  const goToPage = (newPage) => {
    setPage(Math.max(1, Math.min(newPage, paginationInfo.totalPages)));
  };

  const nextPage = () => {
    if (paginationInfo.hasNextPage) {
      setPage(page + 1);
    }
  };

  const prevPage = () => {
    if (paginationInfo.hasPreviousPage) {
      setPage(page - 1);
    }
  };

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1); // Reset to first page when page size changes
  };

  const value = {
    filters,
    updateFilter,
    clearFilters,
    sortField,
    sortDirection,
    updateSort,
    filteredAlerts,
    loading,
    error,
    page,
    pageSize,
    paginationInfo,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    availableCategories,
    availableSeverities,
    availableSourceTypes,
    availableEventTypes
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};