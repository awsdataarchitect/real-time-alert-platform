# Polling Mechanism for Pull-Based Sources

This document describes the implementation of the polling mechanism for pull-based data sources in the Real-Time Alert Platform.

## Overview

The polling mechanism is designed to periodically fetch data from external APIs, normalize it to the platform's alert format, and store it in DynamoDB. It includes caching mechanisms to prevent duplicate processing and optimize API usage.

## Components

### 1. Lambda Function

The `pollDataSources.js` Lambda function is the core of the polling mechanism. It is triggered by EventBridge rules at scheduled intervals and performs the following tasks:

- Fetches data from external APIs using the appropriate connectors
- Normalizes the data to the platform's alert format
- Deduplicates alerts to prevent duplicate processing
- Stores new and updated alerts in DynamoDB
- Updates cache information for future requests

### 2. EventBridge Rules

Multiple EventBridge rules are configured to trigger the Lambda function at different intervals for different data sources:

- **General Rule**: Runs every 15 minutes to poll all data sources
- **USGS Hourly Rule**: Runs every hour to poll USGS earthquake data
- **NOAA Hourly Rule**: Runs every hour to poll NOAA weather data
- **CDC Daily Rule**: Runs every day to poll CDC health data

Each rule passes specific parameters to the Lambda function to customize the polling behavior.

### 3. Cache Table

A DynamoDB table (`alert-cache`) is used to store cache information for each data source, including:

- Last processed alert IDs to prevent duplicate processing
- ETag and Last-Modified headers for conditional HTTP requests
- Last polling timestamp
- TTL for automatic expiration of cache entries

### 4. Connector Enhancements

The existing connectors have been enhanced to support caching mechanisms:

- Support for conditional HTTP requests using ETag and Last-Modified headers
- Handling of 304 Not Modified responses
- Tracking of processed alert IDs for deduplication

## Flow

1. EventBridge rule triggers the Lambda function at scheduled intervals
2. Lambda function retrieves cache data for each data source
3. Lambda function calls the appropriate connectors with cache headers
4. Connectors make conditional HTTP requests to external APIs
5. If data has not changed (304 Not Modified), connectors return empty results
6. If data has changed, connectors normalize and validate the new data
7. Lambda function deduplicates alerts using the cache of processed IDs
8. Lambda function stores new and updated alerts in DynamoDB
9. Lambda function updates cache information for future requests

## Benefits

- **Efficiency**: Reduces unnecessary API calls and data processing
- **Freshness**: Ensures alerts are up-to-date by regularly polling data sources
- **Reliability**: Includes retry mechanisms and error handling
- **Scalability**: Can easily add new data sources and adjust polling frequencies
- **Cost-effectiveness**: Minimizes resource usage through caching and deduplication

## Configuration

The polling mechanism can be configured through the following environment variables:

- `ALERTS_TABLE`: Name of the DynamoDB table for alerts
- `CACHE_TABLE`: Name of the DynamoDB table for cache data

And through the EventBridge rule parameters:

- `sourceTypes`: Array of source types to poll
- `options`: Options for each connector

## Testing

Unit tests have been implemented to verify the functionality of the polling mechanism, including:

- Testing the Lambda function with various inputs
- Testing the caching and deduplication logic
- Testing error handling and retry mechanisms
- Testing the integration with connectors