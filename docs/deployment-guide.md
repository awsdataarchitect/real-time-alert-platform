# Deployment Guide - Real-Time Alert Platform

This guide covers deploying the Real-Time Alert Platform using **Amplify Gen2** with free external APIs and AWS-native services.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured: `aws configure`
3. **Node.js** (v18 or later) and npm
4. **Amplify CLI Gen2**: `npm install -g @aws-amplify/cli@latest`

## Step 1: Clone and Setup

```bash
git clone https://github.com/awsdataarchitect/real-time-alert-platform.git
cd real-time-alert-platform

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

## Step 2: Get External API Keys (Free)

### CDC Health Data API (Free)
1. No registration required - completely free
2. Uses CDC's public data portal
3. No API key needed
4. Just include User-Agent header with contact info

### Other APIs (No keys needed)
- NOAA Weather API: Free, no registration
- USGS Earthquake API: Free, no registration

## Step 3: Install Amplify Gen2 Dependencies

```bash
# Install Gen2 dependencies
npm install aws-amplify@latest @aws-amplify/backend @aws-amplify/backend-cli react-scripts

# Install Amplify CLI globally (optional, for additional commands)
npm install -g @aws-amplify/cli@latest
```

## Step 4: Configure AWS Profile

```bash
# Configure AWS credentials if not already done
aws configure

# Or use AWS SSO
aws configure sso
```

## Step 5: Start Development Sandbox

```bash
# Start the Amplify sandbox for development
npm run amplify:sandbox

# This will:
# - Deploy your backend resources to AWS
# - Create a development environment
# - Generate the amplify_outputs.json file
# - Watch for changes and auto-deploy
```

## Step 6: Configure Your React App

Create or update `src/main.tsx` or `src/index.js`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';

Amplify.configure(outputs);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Replace the generated schema with your alert platform schema:

```graphql
# amplify/backend/api/realtimealertplatform/schema.graphql
type Alert @model @auth(rules: [
  { allow: public, operations: [read] },
  { allow: private, operations: [create, read, update, delete] }
]) {
  id: ID!
  title: String!
  description: String!
  severity: AlertSeverity!
  category: AlertCategory!
  location: Location
  coordinates: Coordinates
  affectedAreas: [String]
  source: String!
  sourceId: String!
  eventType: String!
  startTime: AWSDateTime!
  endTime: AWSDateTime
  isActive: Boolean!
  tags: [String]
  metadata: AWSJSON
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type Location {
  name: String!
  state: String
  country: String!
  zipCode: String
}

type Coordinates {
  latitude: Float!
  longitude: Float!
  radius: Float
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertCategory {
  WEATHER
  EARTHQUAKE
  FIRE
  HEALTH
  SECURITY
  TRAFFIC
  OTHER
}

type UserPreferences @model @auth(rules: [
  { allow: owner }
]) {
  id: ID!
  userId: String! @index(name: "byUserId")
  alertCategories: [AlertCategory]
  notificationMethods: [NotificationMethod]
  location: Location
  radius: Float
  quietHours: QuietHours
  language: String
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type QuietHours {
  enabled: Boolean!
  startTime: String
  endTime: String
  timezone: String
}

enum NotificationMethod {
  EMAIL
  SMS
  PUSH
  IN_APP
}

type Subscription {
  onAlertCreated: Alert @aws_subscribe(mutations: ["createAlert"])
  onAlertUpdated: Alert @aws_subscribe(mutations: ["updateAlert"])
}
```

### Backend Resources (Automatically Configured)
With Amplify Gen2, all backend resources are defined in code:
- **Authentication**: Cognito User Pool with email/username login
- **API**: GraphQL API with type-safe schema
- **Database**: DynamoDB tables for alerts and user preferences
- **Storage**: S3 bucket for file uploads
- **Real-time**: GraphQL subscriptions for live updates

## Step 7: Deploy to Production

### For Production Deployment:
```bash
# Deploy to production branch
npm run amplify:deploy

# Or deploy manually
npx ampx pipeline-deploy --branch main
```

### Generate TypeScript Types:
```bash
# Generate GraphQL client code
npm run amplify:generate

# This creates type-safe GraphQL operations
```

## Step 8: Configure Environment Variables

After running `npm run amplify:sandbox`, the configuration is automatically generated in `amplify_outputs.json`. You can also update your `.env` file with additional variables:

```bash
# External APIs (all free - no keys needed!)
# Just update your email in User-Agent strings

# Feature flags
REACT_APP_ENABLE_OFFLINE_MODE=true
REACT_APP_ENABLE_MESH_NETWORKING=true
REACT_APP_DEBUG_MODE=true
```

## Step 7: Add Lambda Functions for Data Polling

Create Lambda functions to poll external APIs:

For Gen2, create function resources in code:

```typescript
// amplify/functions/poll-weather/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const pollWeather = defineFunction({
  name: 'poll-weather',
  entry: './handler.ts',
  environment: {
    NOAA_API_BASE_URL: 'https://api.weather.gov',
    NOAA_API_USER_AGENT: process.env.NOAA_API_USER_AGENT || 'RealTimeAlertPlatform/1.0 (contact@example.com)',
    CDC_API_BASE_URL: 'https://data.cdc.gov/resource/',
    CDC_API_USER_AGENT: process.env.CDC_API_USER_AGENT || 'RealTimeAlertPlatform/1.0 (contact@example.com)',
    USGS_API_BASE_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/',
    USGS_API_USER_AGENT: process.env.USGS_API_USER_AGENT || 'RealTimeAlertPlatform/1.0 (contact@example.com)',
  },
  schedule: 'rate(1 hour)',
});
```

Then add to your backend:
```typescript
// amplify/backend.ts
import { pollWeather } from './functions/poll-weather/resource';

export const backend = defineBackend({
  auth,
  data,
  storage,
  pollWeather,
});
```

## Step 8: Add Hosting

Hosting is automatically configured with Gen2 when you deploy to production.

## Step 9: Deploy Frontend

```bash
# Build and deploy the React app
npm run build
npm run amplify:deploy

# This will:
# - Build the React application
# - Deploy backend and frontend
# - Configure CloudFront distribution
# - Provide the live URL
```

## Step 10: Configure Mobile App (Optional)

If deploying the React Native mobile app:

```bash
cd mobile

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Copy Amplify configuration from main project
cp ../amplify_outputs.json ./src/

# Configure Amplify in mobile app
# Add to your App.js:
// import { Amplify } from 'aws-amplify';
// import outputs from './src/amplify_outputs.json';
// Amplify.configure(outputs);
```

## Step 11: Set Up Monitoring

### CloudWatch Dashboards
```bash
# Create custom dashboard for monitoring
aws cloudwatch put-dashboard --dashboard-name "RealTimeAlertPlatform" --dashboard-body file://monitoring/dashboard.json
```

### Alarms
```bash
# Set up CloudWatch alarms for critical metrics
aws cloudwatch put-metric-alarm --alarm-name "HighErrorRate" --alarm-description "Alert API error rate too high" --metric-name "4XXError" --namespace "AWS/ApiGateway" --statistic "Sum" --period 300 --threshold 10 --comparison-operator "GreaterThanThreshold"
```

## Step 12: Security Configuration

### Enable MFA (Optional)
MFA is already configured in the Gen2 auth resource (`amplify/auth/resource.ts`):
```typescript
multifactor: {
  mode: 'optional', // Change to 'required' if needed
  sms: true,
  totp: true,
},
```
Update the file and the changes will auto-deploy with sandbox mode.

### Set up WAF (Web Application Firewall)
```bash
# Create WAF rules for API protection
aws wafv2 create-web-acl --name "AlertPlatformWAF" --scope "CLOUDFRONT" --default-action "Allow={}" --rules file://security/waf-rules.json
```

## Step 13: Testing Deployment

### Test APIs
```bash
# Test GraphQL API
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"query":"query { listAlerts { items { id title severity } } }"}' \
  YOUR_GRAPHQL_ENDPOINT

# Test external APIs
curl "https://api.weather.gov/alerts/active?area=US"
curl "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=5"
```

### Test Authentication
1. Visit your deployed app URL
2. Register a new user
3. Verify email confirmation
4. Test login/logout

### Test Notifications
1. Create a test alert through the admin interface
2. Verify SNS notifications are sent
3. Check CloudWatch logs for any errors

## Troubleshooting

### Common Issues

1. **Amplify CLI not found**
   ```bash
   npm install -g @aws-amplify/cli@latest
   ```

2. **AWS credentials not configured**
   ```bash
   aws configure
   ```

3. **GraphQL schema errors**
   - Check schema syntax in `amplify/data/resource.ts`
   - Run `npm run amplify:generate` to validate and generate types

4. **Environment variables not loading**
   - Ensure `.env` file is in project root
   - Restart development server after changes

5. **CORS errors**
   - CORS is automatically configured in Gen2
   - Check your GraphQL schema authorization rules

### Useful Gen2 Commands

```bash
# Start development sandbox
npm run amplify:sandbox

# Deploy to production
npm run amplify:deploy

# Generate TypeScript types
npm run amplify:generate

# View backend resources in AWS Console
npx ampx console

# Delete all resources (careful!)
npx ampx sandbox delete

# View function logs
aws logs tail /aws/lambda/your-function-name --follow
```

## Cost Optimization

1. **Use DynamoDB On-Demand billing** for unpredictable traffic
2. **Set up S3 lifecycle policies** to archive old data
3. **Configure CloudFront caching** to reduce API calls
4. **Use Lambda provisioned concurrency** only if needed
5. **Monitor costs** with AWS Cost Explorer and set up billing alerts

## Next Steps

1. **Set up CI/CD pipeline** with GitHub Actions or AWS CodePipeline
2. **Add comprehensive monitoring** and alerting
3. **Implement backup and disaster recovery**
4. **Add performance testing** and optimization
5. **Set up staging environment** for testing

## Support

- **AWS Amplify Documentation**: https://docs.amplify.aws/
- **AWS Support**: https://aws.amazon.com/support/
- **Community Forums**: https://github.com/aws-amplify/amplify-js/discussions

Your Real-Time Alert Platform should now be fully deployed and operational! 🚀