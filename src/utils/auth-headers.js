// Every REST call and the WebSocket connect authenticate with the signed-in
// user's Cognito ID token (stored by directAuthService at sign-in).
// The API Gateway Cognito authorizer rejects requests without it (401).

export function getIdToken() {
  try {
    return localStorage.getItem('idToken') || '';
  } catch (error) {
    return '';
  }
}

export function getAuthHeaders() {
  const idToken = getIdToken();
  // API Gateway Cognito User Pools authorizers take the raw ID token.
  return idToken ? { Authorization: idToken } : {};
}

// Browsers cannot set headers on a WebSocket upgrade, so the $connect
// authorizer reads the ID token from the `token` query string parameter.
export function withWebSocketToken(endpoint) {
  const idToken = getIdToken();
  if (!endpoint || !idToken) return endpoint;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}token=${encodeURIComponent(idToken)}`;
}
