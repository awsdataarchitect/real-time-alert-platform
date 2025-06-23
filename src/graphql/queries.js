/* eslint-disable */
// This file contains GraphQL queries with filtering parameters

export const listAlerts = /* GraphQL */ `
  query ListAlerts(
    $filter: AlertFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listAlerts(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sourceId
        sourceType
        category
        eventType
        subType
        severity
        certainty
        headline
        description
        instructions
        createdAt
        updatedAt
        startTime
        endTime
        status
        location {
          type
          coordinates
        }
        locationHash
        affectedAreas {
          areaId
          areaName
          areaType
          geometry
        }
        resources {
          resourceType
          mimeType
          uri
          description
        }
        parameters
        version
      }
      nextToken
    }
  }
`;

export const alertsByCategory = /* GraphQL */ `
  query AlertsByCategory(
    $category: AlertCategory!
    $createdAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: AlertFilterInput
    $limit: Int
    $nextToken: String
  ) {
    alertsByCategory(
      category: $category
      createdAt: $createdAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sourceId
        sourceType
        category
        eventType
        subType
        severity
        certainty
        headline
        description
        instructions
        createdAt
        updatedAt
        startTime
        endTime
        status
        location {
          type
          coordinates
        }
        locationHash
        affectedAreas {
          areaId
          areaName
          areaType
          geometry
        }
      }
      nextToken
    }
  }
`;

export const alertsBySeverity = /* GraphQL */ `
  query AlertsBySeverity(
    $severity: AlertSeverity!
    $createdAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: AlertFilterInput
    $limit: Int
    $nextToken: String
  ) {
    alertsBySeverity(
      severity: $severity
      createdAt: $createdAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sourceId
        sourceType
        category
        eventType
        subType
        severity
        certainty
        headline
        description
        instructions
        createdAt
        updatedAt
        startTime
        endTime
        status
        location {
          type
          coordinates
        }
        locationHash
        affectedAreas {
          areaId
          areaName
          areaType
          geometry
        }
      }
      nextToken
    }
  }
`;

export const alertsByStatus = /* GraphQL */ `
  query AlertsByStatus(
    $status: AlertStatus!
    $createdAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: AlertFilterInput
    $limit: Int
    $nextToken: String
  ) {
    alertsByStatus(
      status: $status
      createdAt: $createdAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sourceId
        sourceType
        category
        eventType
        subType
        severity
        certainty
        headline
        description
        instructions
        createdAt
        updatedAt
        startTime
        endTime
        status
        location {
          type
          coordinates
        }
        locationHash
        affectedAreas {
          areaId
          areaName
          areaType
          geometry
        }
      }
      nextToken
    }
  }
`;

export const searchAlertsByLocation = /* GraphQL */ `
  query SearchAlertsByLocation(
    $location: LocationFilterInput!
    $filter: AlertFilterInput
    $limit: Int
    $nextToken: String
  ) {
    searchAlertsByLocation(
      location: $location
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sourceId
        sourceType
        category
        eventType
        subType
        severity
        certainty
        headline
        description
        instructions
        createdAt
        updatedAt
        startTime
        endTime
        status
        location {
          type
          coordinates
        }
        locationHash
        affectedAreas {
          areaId
          areaName
          areaType
          geometry
        }
      }
      nextToken
    }
  }
`;