import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'alertPlatformStorage',
  access: (allow) => ({
    'alert-attachments/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'user-uploads/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});