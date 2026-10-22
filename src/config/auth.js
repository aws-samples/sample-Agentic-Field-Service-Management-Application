const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const appUrl = process.env.REACT_APP_APP_URL || 'http://localhost:3000';

const authConfig = {
  region,
  userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
  oauth: {
    domain: process.env.REACT_APP_COGNITO_DOMAIN || '',
    scope: ['email', 'profile', 'openid'],
    redirectSignIn: `${appUrl}/callback`,
    redirectSignOut: appUrl,
    responseType: 'code'
  }
};

export default authConfig;
