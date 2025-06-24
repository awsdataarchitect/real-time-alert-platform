# External API Keys Setup Guide

This document provides comprehensive information about the **free external API keys** required for the Real-Time Alert Platform, using AWS-native solutions for notifications.

## Required External Services (All Free)

### 1. NOAA Weather API
**Purpose**: Fetches weather alerts and meteorological data
**Cost**: Free
**Setup**:
- NOAA Weather API is **free** and does not require an API key
- **Required**: Must include User-Agent header with contact information
- Base URL: `https://api.weather.gov`
- Documentation: https://www.weather.gov/documentation/services-web-api
- Rate Limits: No authentication required, but be respectful with request frequency

**Environment Variables**:
```bash
# NOAA Weather API Configuration
NOAA_API_BASE_URL=https://api.weather.gov
NOAA_API_ENABLED=true
NOAA_API_TIMEOUT=10000
NOAA_API_USER_AGENT=RealTimeAlertPlatform/1.0 (your-email@example.com)
```

**Important**: Replace `your-email@example.com` with your actual email address for tracking purposes.

### 2. CDC Health Data API
**Purpose**: Fetches health-related data and public health information
**Cost**: Free
**Setup**:
- CDC Data API is **free** and does not require an API key
- **Recommended**: Include User-Agent header with contact information
- Base URL: `https://data.cdc.gov/resource/`
- Documentation: https://dev.socrata.com/foundry/data.cdc.gov/
- Rate Limits: No authentication required, but be respectful with request frequency

**Environment Variables**:
```bash
# CDC Health API Configuration
CDC_API_BASE_URL=https://data.cdc.gov/resource/
CDC_API_ENABLED=true
CDC_API_TIMEOUT=10000
CDC_API_USER_AGENT=RealTimeAlertPlatform/1.0 (your-email@example.com)
```

**Important**: Replace `your-email@example.com` with your actual email address for tracking purposes.

### 3. USGS Earthquake API
**Purpose**: Fetches earthquake data and seismic alerts
**Cost**: Free
**Setup**:
- USGS Earthquake API is **free** and does not require an API key
- **Recommended**: Include User-Agent header with contact information
- Base URL: `https://earthquake.usgs.gov/fdsnws/event/1/`
- Documentation: https://earthquake.usgs.gov/fdsnws/event/1/
- Rate Limits: No authentication required, but be respectful with request frequency

**Environment Variables**:
```bash
# USGS Earthquake API Configuration
USGS_API_BASE_URL=https://earthquake.usgs.gov/fdsnws/event/1/
USGS_API_ENABLED=true
USGS_API_TIMEOUT=10000
USGS_API_USER_AGENT=RealTimeAlertPlatform/1.0 (your-email@example.com)
```

**Important**: Replace `your-email@example.com` with your actual email address for tracking purposes.

## AWS Native Services (Included with AWS Account)

### 4. AWS SNS (Simple Notification Service)
**Purpose**: Send SMS, email, and push notifications
**Cost**: Pay-per-message (very low cost: $0.50/million requests)
**Setup**: Automatically configured with Amplify deployment

**Environment Variables**:
```bash
# AWS SNS Configuration
AWS_SNS_ENABLED=true
AWS_SNS_SMS_ENABLED=true
AWS_SNS_EMAIL_ENABLED=true
AWS_SNS_PUSH_ENABLED=true
AWS_SNS_REGION=us-east-1
```

### 5. AWS Pinpoint (Push Notifications)
**Purpose**: Mobile push notifications
**Cost**: Free tier: 5,000 targeted users/month
**Setup**: Configured through Amplify

**Environment Variables**:
```bash
# AWS Pinpoint Configuration
AWS_PINPOINT_ENABLED=true
AWS_PINPOINT_APP_ID=your_pinpoint_app_id
AWS_PINPOINT_REGION=us-east-1
```

### 6. AWS Location Service (Maps)
**Purpose**: Map visualization and geospatial services
**Cost**: Free tier: 100,000 map tile requests/month
**Setup**: Configured through Amplify

**Environment Variables**:
```bash
# AWS Location Service Configuration
AWS_LOCATION_ENABLED=true
AWS_LOCATION_MAP_NAME=your_map_name
AWS_LOCATION_PLACE_INDEX=your_place_index
AWS_LOCATION_REGION=us-east-1
```

## Amplify Gen2 Setup Guide (Code-First)

### Prerequisites
```bash
# Configure AWS CLI
aws configure
# Or for SSO: aws configure sso
```

### 1. Install Amplify Gen2 Dependencies
```bash
cd real-time-alert-platform

# Install Gen2 dependencies
npm install aws-amplify@latest @aws-amplify/backend @aws-amplify/backend-cli react-scripts

# Optional: Install CLI globally
npm install -g @aws-amplify/cli@latest
```

### 2. Backend Configuration (Already Created)
The following Gen2 configuration files are already set up:
- `amplify/backend.ts` - Main backend definition
- `amplify/auth/resource.ts` - Authentication (Cognito)
- `amplify/data/resource.ts` - GraphQL API & DynamoDB
- `amplify/storage/resource.ts` - S3 file storage

### 3. Start Development Sandbox
```bash
# This replaces "amplify init" and "amplify push"
npm run amplify:sandbox

# Or directly:
npx ampx sandbox
```

This command will:
- ✅ Deploy all AWS resources automatically
- ✅ Create Cognito User Pool and Identity Pool
- ✅ Create GraphQL API with DynamoDB tables
- ✅ Create S3 bucket for file storage
- ✅ Generate `amplify_outputs.json` with configuration
- ✅ Watch for changes and auto-deploy

### 4. Configure Your React App
```javascript
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';

Amplify.configure(outputs);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

### 5. Deploy to Production
```bash
# Deploy to production
npm run amplify:deploy

# Or directly:
npx ampx pipeline-deploy --branch main
```

### 6. Generate TypeScript Types
```bash
# Generate type-safe GraphQL client code
npm run amplify:generate
```

## Alternative: CDK TypeScript Setup

If you prefer CDK TypeScript, here's the basic structure:

### 1. Initialize CDK Project
```bash
mkdir real-time-alert-platform-cdk
cd real-time-alert-platform-cdk

npx aws-cdk init app --language typescript
npm install @aws-cdk/aws-cognito @aws-cdk/aws-appsync @aws-cdk/aws-dynamodb @aws-cdk/aws-s3 @aws-cdk/aws-sns @aws-cdk/aws-pinpoint
```

### 2. Create Infrastructure Stack
```typescript
// lib/real-time-alert-platform-stack.ts
import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';

export class RealTimeAlertPlatformStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'AlertPlatformUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { username: true, email: true },
      autoVerify: { email: true },
    });

    // GraphQL API
    const api = new appsync.GraphqlApi(this, 'AlertPlatformAPI', {
      name: 'real-time-alert-platform-api',
      schema: appsync.Schema.fromAsset('schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
    });

    // DynamoDB Tables
    const alertsTable = new dynamodb.Table(this, 'AlertsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // S3 Bucket
    const storageBucket = new s3.Bucket(this, 'AlertPlatformStorage', {
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // SNS Topic
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: 'Real-Time Alert Platform Notifications',
    });
  }
}
```

## Environment Configuration

### Updated .env.example
```bash
# AWS Configuration
REACT_APP_AWS_REGION=us-east-1

# Cognito Configuration
REACT_APP_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_USER_POOL_WEB_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_IDENTITY_POOL_ID=us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

# OAuth Configuration (optional)
REACT_APP_OAUTH_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
REACT_APP_REDIRECT_SIGN_IN=http://localhost:3000/
REACT_APP_REDIRECT_SIGN_OUT=http://localhost:3000/

# GraphQL API Configuration
REACT_APP_GRAPHQL_ENDPOINT=https://XXXXXXXXXXXXXXXXXXXXXXXXXX.appsync-api.us-east-1.amazonaws.com/graphql
REACT_APP_API_KEY=da2-XXXXXXXXXXXXXXXXXXXXXXXXXX

# S3 Configuration
REACT_APP_S3_BUCKET=your-bucket-name

# AWS SNS Configuration
AWS_SNS_ENABLED=true
AWS_SNS_SMS_ENABLED=true
AWS_SNS_EMAIL_ENABLED=true
AWS_SNS_PUSH_ENABLED=true
AWS_SNS_REGION=us-east-1

# AWS Pinpoint Configuration
REACT_APP_PINPOINT_APP_ID=your_pinpoint_app_id
AWS_PINPOINT_ENABLED=true
AWS_PINPOINT_REGION=us-east-1

# AWS Location Service Configuration
REACT_APP_LOCATION_MAP_NAME=your_map_name
REACT_APP_LOCATION_PLACE_INDEX=your_place_index
AWS_LOCATION_ENABLED=true
AWS_LOCATION_REGION=us-east-1

# External APIs (Free)
NOAA_API_BASE_URL=https://api.weather.gov
NOAA_API_ENABLED=true
NOAA_API_TIMEOUT=10000

CDC_API_BASE_URL=https://data.cdc.gov/resource/
CDC_API_ENABLED=true
CDC_API_USER_AGENT=RealTimeAlertPlatform/1.0 (your-email@example.com)
CDC_API_TIMEOUT=10000

USGS_API_BASE_URL=https://earthquake.usgs.gov/fdsnws/event/1/
USGS_API_ENABLED=true
USGS_API_TIMEOUT=10000

# Feature Flags
REACT_APP_ENABLE_REGISTRATION=true
REACT_APP_ENABLE_SOCIAL_LOGIN=false
REACT_APP_ENABLE_MFA=false
REACT_APP_ENABLE_OFFLINE_MODE=true
REACT_APP_ENABLE_MESH_NETWORKING=true

# Security Configuration
REACT_APP_SESSION_TIMEOUT=3600
REACT_APP_ENABLE_AUDIT_LOGGING=true

# Development Configuration
NODE_ENV=development
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=info
```

## Testing Free APIs

### Test NOAA Weather API
```bash
curl -H "User-Agent: RealTimeAlertPlatform/1.0 (your-email@example.com)" "https://api.weather.gov/alerts/active?area=US"
```

### Test CDC API
```bash
curl -H "User-Agent: RealTimeAlertPlatform/1.0 (your-email@example.com)" "https://data.cdc.gov/resource/unsk-b7fc.json?$limit=5"
```

### Test USGS Earthquake API
```bash
curl -H "User-Agent: RealTimeAlertPlatform/1.0 (your-email@example.com)" "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=10"
```

## Cost Estimation (AWS Services Only)

| Service | Free Tier | Typical Monthly Cost |
|---------|-----------|---------------------|
| NOAA Weather | Free (no key) | $0 |
| CDC Health Data | Free (no key) | $0 |
| USGS Earthquake | Free (no key) | $0 |
| AWS Cognito | 50,000 MAUs | $0-55+ |
| AWS AppSync | 250,000 requests | $0-4+ |
| AWS DynamoDB | 25GB storage | $0-25+ |
| AWS S3 | 5GB storage | $0-23+ |
| AWS SNS | 1M requests | $0-0.50+ |
| AWS Pinpoint | 5,000 users | $0-1+ |
| AWS Location | 100K requests | $0-50+ |

**Total estimated monthly cost for moderate usage: $0-160**

## Security Best Practices

1. **Use AWS Secrets Manager for CDC API key**
2. **Enable MFA for Cognito users**
3. **Use least privilege IAM policies**
4. **Enable CloudTrail for audit logging**
5. **Use VPC endpoints for internal communication**
6. **Enable encryption at rest and in transit**

## Next Steps

1. Choose between Amplify Gen2 or CDK TypeScript
2. Update email addresses in User-Agent strings
3. Deploy infrastructure
4. Configure environment variables
5. Test API integrations
6. Deploy application

**All external APIs are now FREE with no API keys required!** 🎉

Would you like me to help with any specific part of the setup?