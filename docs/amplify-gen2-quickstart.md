# Amplify Gen2 Quick Start Guide

This is a quick reference for getting started with AWS Amplify Gen2 for the Real-Time Alert Platform.

## 🚀 Quick Setup (5 minutes)

### 1. Prerequisites
```bash
# Ensure you have AWS CLI configured
aws configure

# Verify Node.js version (18+ required)
node --version
```

### 2. Install Dependencies
```bash
cd real-time-alert-platform

# Install Gen2 dependencies
npm install aws-amplify@latest @aws-amplify/backend @aws-amplify/backend-cli react-scripts
```

### 3. Start Development
```bash
# Start the sandbox (replaces amplify init + push)
npm run amplify:sandbox

# In another terminal, start React app
npm start
```

That's it! Your backend is deployed and your app is running.

## 📁 Gen2 Project Structure

```
real-time-alert-platform/
├── amplify/
│   ├── backend.ts              # Main backend definition
│   ├── auth/resource.ts        # Authentication config
│   ├── data/resource.ts        # GraphQL API & Database
│   └── storage/resource.ts     # S3 file storage
├── amplify_outputs.json        # Auto-generated config
└── src/
    └── components/
        └── AlertList.tsx       # Example component
```

## 🔧 Key Gen2 Concepts

### Code-First Configuration
- **Gen1**: CLI-driven with JSON configs
- **Gen2**: TypeScript-first with type safety

### Auto-Deploy
- **Gen1**: Manual `amplify push`
- **Gen2**: Auto-deploy on file save in sandbox mode

### Type Safety
- **Gen1**: Manual type generation
- **Gen2**: Automatic TypeScript types

## 📝 Common Commands

| Task | Gen1 Command | Gen2 Command |
|------|-------------|-------------|
| Initialize | `amplify init` | `npm run amplify:sandbox` |
| Deploy changes | `amplify push` | Auto-deploy in sandbox |
| Add auth | `amplify add auth` | Edit `amplify/auth/resource.ts` |
| Add API | `amplify add api` | Edit `amplify/data/resource.ts` |
| Add storage | `amplify add storage` | Edit `amplify/storage/resource.ts` |
| Deploy to prod | `amplify publish` | `npm run amplify:deploy` |
| Generate types | `amplify codegen` | `npm run amplify:generate` |
| View console | `amplify console` | `npx ampx console` |
| Delete resources | `amplify delete` | `npx ampx sandbox delete` |

## 🔐 Authentication Usage

```typescript
import { signUp, signIn, signOut, getCurrentUser } from 'aws-amplify/auth';

// Sign up
await signUp({
  username: 'user@example.com',
  password: 'TempPassword123!',
  options: {
    userAttributes: {
      email: 'user@example.com',
    },
  },
});

// Sign in
await signIn({
  username: 'user@example.com',
  password: 'TempPassword123!',
});

// Get current user
const user = await getCurrentUser();

// Sign out
await signOut();
```

## 📊 GraphQL API Usage

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

// Create alert
const { data } = await client.models.Alert.create({
  title: 'Weather Alert',
  description: 'Severe thunderstorm warning',
  severity: 'HIGH',
  category: 'WEATHER',
  source: 'NOAA',
  sourceId: 'noaa-001',
  eventType: 'THUNDERSTORM',
  startTime: new Date().toISOString(),
  isActive: true,
});

// List alerts
const { data: alerts } = await client.models.Alert.list();

// Subscribe to real-time updates
const subscription = client.models.Alert.onCreate().subscribe({
  next: (alert) => console.log('New alert:', alert),
});
```

## 📁 File Storage Usage

```typescript
import { uploadData, getUrl, list } from 'aws-amplify/storage';

// Upload file
await uploadData({
  key: 'alert-attachments/image.jpg',
  data: file,
  options: {
    accessLevel: 'protected',
  },
});

// Get file URL
const { url } = await getUrl({
  key: 'alert-attachments/image.jpg',
  options: {
    accessLevel: 'protected',
  },
});

// List files
const { items } = await list({
  prefix: 'alert-attachments/',
  options: {
    accessLevel: 'protected',
  },
});
```

## 🔄 Real-time Subscriptions

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

// Subscribe to new alerts
const subscription = client.models.Alert.onCreate().subscribe({
  next: (alert) => {
    console.log('New alert received:', alert);
    // Update UI with new alert
  },
  error: (error) => console.error('Subscription error:', error),
});

// Subscribe to alert updates
const updateSubscription = client.models.Alert.onUpdate().subscribe({
  next: (alert) => {
    console.log('Alert updated:', alert);
    // Update UI with changed alert
  },
});

// Clean up subscriptions
subscription.unsubscribe();
updateSubscription.unsubscribe();
```

## 🚀 Deployment Modes

### Development (Sandbox)
```bash
# Start sandbox - auto-deploys changes
npm run amplify:sandbox

# Features:
# - Auto-deploy on save
# - Isolated environment per developer
# - Fast iteration
# - Temporary resources
```

### Production
```bash
# Deploy to production branch
npm run amplify:deploy

# Features:
# - Persistent resources
# - CI/CD integration
# - Environment promotion
# - Production-ready configuration
```

## 🐛 Troubleshooting

### Common Issues

1. **Sandbox won't start**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   
   # Clear cache and retry
   rm -rf node_modules/.cache
   npm run amplify:sandbox
   ```

2. **TypeScript errors**
   ```bash
   # Regenerate types
   npm run amplify:generate
   ```

3. **Authentication errors**
   ```bash
   # Check auth configuration
   cat amplify_outputs.json | grep -A 10 "auth"
   ```

4. **GraphQL errors**
   ```bash
   # Validate schema
   npm run amplify:generate
   ```

### Getting Help

- **Documentation**: https://docs.amplify.aws/react/
- **Discord**: https://discord.gg/amplify
- **GitHub**: https://github.com/aws-amplify/amplify-js
- **Stack Overflow**: Tag with `aws-amplify`

## 🎯 Next Steps

1. **Explore the example components** in `src/components/`
2. **Customize the GraphQL schema** in `amplify/data/resource.ts`
3. **Add Lambda functions** for external API polling
4. **Set up CI/CD** with GitHub Actions
5. **Deploy to production** when ready

## 📚 Additional Resources

- [Amplify Gen2 Documentation](https://docs.amplify.aws/react/)
- [GraphQL Schema Design](https://docs.amplify.aws/react/build-a-backend/data/)
- [Authentication Guide](https://docs.amplify.aws/react/build-a-backend/auth/)
- [File Storage Guide](https://docs.amplify.aws/react/build-a-backend/storage/)
- [Real-time Subscriptions](https://docs.amplify.aws/react/build-a-backend/data/subscribe-data/)

Happy building! 🚀