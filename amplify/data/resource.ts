import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Alert: a
    .model({
      title: a.string().required(),
      description: a.string().required(),
      severity: a.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      category: a.enum(['WEATHER', 'EARTHQUAKE', 'FIRE', 'HEALTH', 'SECURITY', 'TRAFFIC', 'OTHER']),
      locationName: a.string(),
      locationState: a.string(),
      locationCountry: a.string(),
      locationZipCode: a.string(),
      latitude: a.float(),
      longitude: a.float(),
      radius: a.float(),
      affectedAreas: a.string().array(),
      source: a.string().required(),
      sourceId: a.string().required(),
      eventType: a.string().required(),
      startTime: a.datetime().required(),
      endTime: a.datetime(),
      isActive: a.boolean().required().default(true),
      tags: a.string().array(),
      metadata: a.json(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ]),

  UserPreferences: a
    .model({
      userId: a.string().required(),
      alertCategories: a.string().array(),
      notificationMethods: a.string().array(),
      locationName: a.string(),
      locationState: a.string(),
      locationCountry: a.string(),
      locationZipCode: a.string(),
      radius: a.float(),
      quietHoursEnabled: a.boolean().default(false),
      quietHoursStart: a.string(),
      quietHoursEnd: a.string(),
      quietHoursTimezone: a.string(),
      language: a.string().default('en'),
    })
    .authorization((allow) => [allow.owner()]),

  AlertSubscription: a
    .model({
      userId: a.string().required(),
      alertId: a.string().required(),
      isRead: a.boolean().default(false),
      notifiedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});