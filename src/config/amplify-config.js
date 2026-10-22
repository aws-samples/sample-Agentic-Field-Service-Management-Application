import { getAuthHeaders } from '../utils/auth-headers';

const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const appUrl = process.env.REACT_APP_APP_URL || 'http://localhost:3000';
const appDomain = new URL(appUrl).hostname;

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
      signUpVerificationMethod: 'code',
      loginWith: { email: true, phone: false, username: false }
    },
    authenticationFlowType: 'USER_PASSWORD_AUTH',
    cookieStorage: {
      domain: appDomain,
      path: '/',
      expires: 365,
      sameSite: appUrl.startsWith('https://') ? 'none' : 'lax',
      secure: appUrl.startsWith('https://')
    }
  },
  region,
  API: {
    endpoints: [
      {
        name: 'fsm-api',
        endpoint: process.env.REACT_APP_API_ENDPOINT || '',
        region,
        custom_header: async () => ({
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        })
      }
    ]
  }
};

export default amplifyConfig;
