/**
 * Shared CORS helpers for FSM Lambda handlers.
 *
 * The allowed origin is injected by CloudFormation through the CORS_ORIGIN
 * environment variable (the CloudFront distribution URL). A wildcard origin is
 * never emitted, and Access-Control-Allow-Credentials is intentionally absent:
 * the browser client authenticates with a Cognito ID token in the Authorization header, not
 * cookies, so credentialed CORS is not required.
 */

const DEFAULT_ALLOWED_HEADERS = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token';
const DEFAULT_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';

/**
 * Resolve the single allowed origin. Falls back to 'null' (which matches no
 * browser origin) when the environment variable is missing or set to '*', so a
 * misconfigured deployment fails closed instead of open.
 */
function resolveAllowedOrigin() {
  const configured = (process.env.CORS_ORIGIN || '').trim();
  if (!configured || configured === '*') {
    return 'null';
  }
  return configured.startsWith('http://') || configured.startsWith('https://')
    ? configured.replace(/\/+$/, '')
    : `https://${configured.replace(/\/+$/, '')}`;
}

/**
 * Build the CORS response headers.
 * @param {string} [methods] comma-separated allowed methods
 * @returns {Object}
 */
function corsHeaders(methods = DEFAULT_ALLOWED_METHODS) {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(),
    'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': methods,
    Vary: 'Origin'
  };
}

/**
 * Wraps a Lambda handler function to add CORS headers to all responses.
 * @param {Function} handler - The original Lambda handler function
 * @returns {Function} - The wrapped handler function with CORS headers
 */
const withCors = (handler) => async (event, context) => {
  const headers = corsHeaders();

  if (event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    const response = await handler(event, context);
    return {
      ...response,
      headers: {
        ...(response.headers || {}),
        ...headers
      }
    };
  } catch (error) {
    console.error('CORS wrapper: unhandled error in handler', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

module.exports = { withCors, corsHeaders, resolveAllowedOrigin };
