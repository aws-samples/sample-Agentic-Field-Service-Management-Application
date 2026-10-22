// Direct authentication service that bypasses Amplify
// This uses direct fetch calls to Cognito API

// Cognito configuration is injected at build time by deploy-stack.sh.
const COGNITO_REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;
const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID || '';
const CLIENT_ID = process.env.REACT_APP_USER_POOL_CLIENT_ID || '';

const cognitoPost = (target, body) =>
  fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`
    },
    body: JSON.stringify(body)
  });

// Direct authentication service
export const directAuthService = {
  // Sign in a user directly with Cognito
  signIn: async (username, password) => {
    try {
      console.log('directAuthService - signIn attempt for:', username);
      
      const response = await cognitoPost('InitiateAuth', {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password }
      });
      
      const data = await response.json();
      console.log('directAuthService - signIn response:', data);
      
      // Handle password reset required — return a challenge instead of throwing
      if (data.__type === 'PasswordResetRequiredException') {
        localStorage.setItem('resetUsername', username);
        return { challengeName: 'PASSWORD_RESET_REQUIRED', username };
      }

      if (!response.ok) {
        throw new Error(data.message || data.__type || 'Authentication failed');
      }
      
      if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        localStorage.setItem('challengeSession', data.Session);
        localStorage.setItem('challengeUsername', username);
        return { challengeName: 'NEW_PASSWORD_REQUIRED', username, session: data.Session };
      }

      if (data.AuthenticationResult) {
        localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
        localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
        localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);
        localStorage.setItem('sessionData', JSON.stringify({ username, loginTime: new Date().toISOString() }));
      }
      
      return { isSignedIn: true };
    } catch (error) {
      console.error('directAuthService - Error signing in:', error);
      if (error.name === 'TypeError') {
        throw new Error('Network connection issue. Please check your internet connection and try again.');
      }
      throw error;
    }
  },

  // Initiate forgot password — sends verification code to user's email
  forgotPassword: async (username) => {
    try {
      const response = await cognitoPost('ForgotPassword', {
        ClientId: CLIENT_ID,
        Username: username
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.__type || 'Failed to initiate password reset');
      localStorage.setItem('resetUsername', username);
      return { codeDeliveryDetails: data.CodeDeliveryDetails };
    } catch (error) {
      console.error('directAuthService - forgotPassword error:', error);
      throw error;
    }
  },

  // Confirm forgot password — submits code + new password
  confirmForgotPassword: async (username, code, newPassword) => {
    try {
      const response = await cognitoPost('ConfirmForgotPassword', {
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.__type || 'Failed to reset password');
      localStorage.removeItem('resetUsername');
      return { success: true };
    } catch (error) {
      console.error('directAuthService - confirmForgotPassword error:', error);
      throw error;
    }
  },
  
  // Complete new password challenge
  completeNewPassword: async (username, newPassword) => {
    try {
      console.log('directAuthService - completeNewPassword for:', username);
      
      const session = localStorage.getItem('challengeSession');
      if (!session) throw new Error('No challenge session found');
      
      const response = await cognitoPost('RespondToAuthChallenge', {
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: CLIENT_ID,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
        Session: session
      });
      
      const data = await response.json();
      console.log('directAuthService - completeNewPassword response:', data);
      
      if (!response.ok) {
        throw new Error(data.__type || data.message || 'Failed to set new password');
      }
      
      // Store tokens if available
      if (data.AuthenticationResult) {
        localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
        localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
        localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);
        localStorage.setItem('sessionData', JSON.stringify({
          username,
          loginTime: new Date().toISOString()
        }));
        
        // Clear challenge data
        localStorage.removeItem('challengeSession');
        localStorage.removeItem('challengeUsername');
      }
      
      return { isSignedIn: true };
    } catch (error) {
      console.error('directAuthService - Error completing new password challenge:', error);
      
      if (error.message?.includes('Network Error') || error.name === 'TypeError') {
        throw new Error('Network connection issue. Please check your internet connection and try again.');
      } else if (error.message?.includes('Password does not conform to policy')) {
        throw new Error('Password does not meet the requirements. Please try a different password.');
      } else {
        throw error;
      }
    }
  },
  
  // Sign out
  signOut: async () => {
    try {
      console.log('directAuthService - signOut');
      
      // Clear all authentication data from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionData');
      localStorage.removeItem('challengeSession');
      localStorage.removeItem('challengeUsername');
      
      // Clear any cookies related to authentication
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      return true;
    } catch (error) {
      console.error('directAuthService - Error signing out:', error);
      
      // Even if there's an error, try to clear localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionData');
      
      throw error;
    }
  },
  
  // Get current user
  getCurrentUser: async () => {
    try {
      console.log('directAuthService - getCurrentUser');
      
      const idToken = localStorage.getItem('idToken');
      if (!idToken) {
        return null;
      }
      
      // Parse the ID token to get user information
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      
      return {
        username: payload.email || payload['cognito:username'] || payload.sub,
        attributes: {
          email: payload.email,
          name: payload.name || payload.email || 'User'
        }
      };
    } catch (error) {
      console.error('directAuthService - Error getting current user:', error);
      return null;
    }
  },
  
  // Check if the user is authenticated
  isAuthenticated: async () => {
    try {
      console.log('directAuthService - isAuthenticated check');
      
      const accessToken = localStorage.getItem('accessToken');
      const idToken = localStorage.getItem('idToken');
      
      if (!accessToken || !idToken) {
        return false;
      }
      
      // Check if the token is expired
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        
        if (Date.now() >= expirationTime) {
          console.log('directAuthService - Token expired');
          return false;
        }
      } catch (tokenError) {
        console.error('directAuthService - Error parsing token:', tokenError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('directAuthService - Error checking authentication:', error);
      return false;
    }
  },
  
  // Get JWT token
  getJwtToken: async () => {
    return localStorage.getItem('idToken');
  }
};

export default directAuthService;
