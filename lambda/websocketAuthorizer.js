/**
 * WebSocket $connect REQUEST authorizer.
 *
 * Browsers cannot set headers on a WebSocket upgrade, so the SPA passes its
 * Cognito ID token as the `token` query string parameter. The token is verified
 * with aws-jwt-verify (signature against the user pool JWKS, issuer, audience,
 * token_use and expiry); anything else is rejected with 401.
 */
const { CognitoJwtVerifier } = require('aws-jwt-verify');

const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
  throw new Error('USER_POOL_ID and USER_POOL_CLIENT_ID must be set');
}

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: USER_POOL_CLIENT_ID
});

exports.handler = async (event) => {
  const token = event && event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    throw new Error('Unauthorized');
  }

  let claims;
  try {
    claims = await verifier.verify(token);
  } catch (err) {
    // Never log the token itself.
    console.warn('WebSocket token rejected:', err && err.name);
    throw new Error('Unauthorized');
  }

  return {
    principalId: claims.sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn
        }
      ]
    },
    context: {
      sub: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : ''
    }
  };
};
