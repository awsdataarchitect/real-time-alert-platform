/* eslint-disable */
// This file contains GraphQL mutations for the application

export const updateUserDashboardPreferences = /* GraphQL */ `
  mutation UpdateUserDashboardPreferences(
    $userId: ID!
    $dashboardPreferences: DashboardPreferencesInput!
  ) {
    updateUser(
      id: $userId
      input: {
        dashboardPreferences: $dashboardPreferences
      }
    ) {
      id
      dashboardPreferences {
        defaultView
        favoriteFilters
        mapSettings {
          defaultZoom
          defaultCenter {
            latitude
            longitude
          }
          layerVisibility
        }
      }
    }
  }
`;

export const saveFavoriteFilter = /* GraphQL */ `
  mutation SaveFavoriteFilter(
    $userId: ID!
    $filterName: String!
    $currentFilters: [String]
  ) {
    updateUser(
      id: $userId
      input: {
        dashboardPreferences: {
          favoriteFilters: $currentFilters
        }
      }
    ) {
      id
      dashboardPreferences {
        favoriteFilters
      }
    }
  }
`;

export const updateMapSettings = /* GraphQL */ `
  mutation UpdateMapSettings(
    $userId: ID!
    $defaultZoom: Float
    $defaultCenter: CoordinatesInput
    $layerVisibility: AWSJSON
  ) {
    updateUser(
      id: $userId
      input: {
        dashboardPreferences: {
          mapSettings: {
            defaultZoom: $defaultZoom
            defaultCenter: $defaultCenter
            layerVisibility: $layerVisibility
          }
        }
      }
    ) {
      id
      dashboardPreferences {
        mapSettings {
          defaultZoom
          defaultCenter {
            latitude
            longitude
          }
          layerVisibility
        }
      }
    }
  }
`;

export const updateDefaultView = /* GraphQL */ `
  mutation UpdateDefaultView(
    $userId: ID!
    $defaultView: String!
  ) {
    updateUser(
      id: $userId
      input: {
        dashboardPreferences: {
          defaultView: $defaultView
        }
      }
    ) {
      id
      dashboardPreferences {
        defaultView
      }
    }
  }
`;