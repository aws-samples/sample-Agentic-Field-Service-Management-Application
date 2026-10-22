import { getAuthHeaders } from '../utils/auth-headers';

const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const appUrl = process.env.REACT_APP_APP_URL || 'http://localhost:3000';
const appDomain = new URL(appUrl).hostname;
const userPoolId = process.env.REACT_APP_USER_POOL_ID || '';
const userPoolClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID || '';

export const amplifyConfigLegacy = {
  aws_project_region: region,
  aws_cognito_region: region,
  aws_user_pools_id: userPoolId,
  aws_user_pools_web_client_id: userPoolClientId,
  Auth: {
    region,
    userPoolId,
    userPoolWebClientId: userPoolClientId,
    mandatorySignIn: true,
    authenticationFlowType: 'USER_PASSWORD_AUTH',
    cookieStorage: {
      domain: appDomain,
      path: '/',
      expires: 365,
      sameSite: appUrl.startsWith('https://') ? 'none' : 'lax',
      secure: appUrl.startsWith('https://')
    },
    oauth: {
      domain: process.env.REACT_APP_COGNITO_DOMAIN || '',
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: `${appUrl}/callback`,
      redirectSignOut: appUrl,
      responseType: 'code'
    }
  },
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

export default amplifyConfigLegacy;
