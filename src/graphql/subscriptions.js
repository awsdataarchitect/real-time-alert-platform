/* eslint-disable */
// This file was automatically generated and should not be edited.

export const onCreateAlert = /* GraphQL */ `
  subscription OnCreateAlert {
    onCreateAlert {
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
      lastProcessedAt
      processedBy
      consolidatedFrom
    }
  }
`;

export const onUpdateAlert = /* GraphQL */ `
  subscription OnUpdateAlert {
    onUpdateAlert {
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
      lastProcessedAt
      processedBy
      consolidatedFrom
    }
  }
`;

export const onDeleteAlert = /* GraphQL */ `
  subscription OnDeleteAlert {
    onDeleteAlert {
      id
    }
  }
`;

export const onAlertByLocation = /* GraphQL */ `
  subscription OnAlertByLocation(
    $latitude: Float!
    $longitude: Float!
    $radiusInKm: Float!
  ) {
    onAlertByLocation(
      latitude: $latitude
      longitude: $longitude
      radiusInKm: $radiusInKm
    ) {
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
  }
`;