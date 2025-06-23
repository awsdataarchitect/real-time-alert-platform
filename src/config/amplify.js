import { Amplify } from 'aws-amplify';

// Amplify configuration
const amplifyConfig = {
  Auth: {
    region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
    mandatorySignIn: false,
    authenticationFlowType: 'USER_SRP_AUTH',
    oauth: {
      domain: process.env.REACT_APP_OAUTH_DOMAIN,
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: process.env.REACT_APP_REDIRECT_SIGN_IN || 'http://localhost:3000/',
      redirectSignOut: process.env.REACT_APP_REDIRECT_SIGN_OUT || 'http://localhost:3000/',
      responseType: 'code'
    }
  },
  API: {
    GraphQL: {
      endpoint: process.env.REACT_APP_GRAPHQL_ENDPOINT,
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool',
      apiKey: process.env.REACT_APP_API_KEY
    }
  },
  Storage: {
    region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
    bucket: process.env.REACT_APP_S3_BUCKET,
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID
  }
};

// Configure Amplify
Amplify.configure(amplifyConfig);

export default amplifyConfig;