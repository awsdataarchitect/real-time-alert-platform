# Geospatial Processing

This document describes the geospatial processing capabilities of the Real-Time Alert Platform.

## Overview

The geospatial processing component is responsible for:

1. Calculating geohashes for alert locations
2. Determining affected areas based on alert type and severity
3. Estimating population impact
4. Enabling efficient geospatial queries

## Architecture

The geospatial processing is implemented as a Lambda function that processes alerts with location data. The function is triggered by an EventBridge scheduled rule to process new alerts periodically.

![Geospatial Processing Architecture](../assets/geospatial-processing-architecture.png)

## Geohash Indexing

Geohashes are used to efficiently index and query alerts by location. A geohash is a hierarchical spatial data structure that subdivides space into grid cells. The longer the geohash, the more precise the location.

Benefits of using geohashes:
- Efficient proximity searches
- Simple string-based indexing in DynamoDB
- Hierarchical structure for different precision levels

## Affected Area Determination

The system determines affected areas based on:

1. Alert type (earthquake, flood, tornado, etc.)
2. Alert severity
3. Location type (point, polygon, multi-polygon)

For point locations, a buffer is created around the point with a radius determined by the alert type and severity. For example:
- Earthquakes: Buffer radius based on magnitude (logarithmic scale)
- Tornados: Smaller, more focused buffer
- Hurricanes: Large buffer covering extensive areas

For polygon locations, the system uses the polygon as is or adds a small buffer to account for uncertainty.

## Population Impact Estimation

The system estimates the population impact of an alert based on:

1. The size of the affected area
2. Population density estimates for the area

This information helps emergency responders prioritize their efforts and allocate resources effectively.

## DynamoDB Indexes

The Alerts table includes the following indexes for geospatial queries:

1. `ByLocation` GSI: Indexes alerts by `locationHash` for region-based queries
2. `ByGeohash` GSI: Indexes alerts by `geohash` for precise location-based queries

## Usage

### Querying Alerts by Location

To query alerts by location:

```javascript
const params = {
  TableName: ALERTS_TABLE,
  IndexName: 'ByGeohash',
  KeyConditionExpression: 'geohash = :geohash',
  ExpressionAttributeValues: {
    ':geohash': 'u4pruyd'  // Example geohash for San Francisco
  }
};

const result = await dynamoDB.query(params).promise();
```

### Querying Alerts by Proximity

To find alerts near a specific location:

1. Calculate the geohash for the target location
2. Calculate neighboring geohashes
3. Query for alerts in the target geohash and its neighbors

```javascript
const targetGeohash = encodeGeohash(37.7749, -122.4194);
const neighbors = getNeighbors(targetGeohash);
const geohashes = [targetGeohash, ...Object.values(neighbors)];

// Query for alerts in all geohashes
const results = await Promise.all(geohashes.map(async (geohash) => {
  const params = {
    TableName: ALERTS_TABLE,
    IndexName: 'ByGeohash',
    KeyConditionExpression: 'geohash = :geohash',
    ExpressionAttributeValues: {
      ':geohash': geohash
    }
  };
  
  return dynamoDB.query(params).promise();
}));
```

## Future Enhancements

1. Integration with population density databases for more accurate impact estimates
2. Real-time geofencing to notify users when they enter affected areas
3. Predictive modeling for alert spread (e.g., flood progression, fire spread)
4. Integration with terrain data for more accurate affected area determination