// API configuration is injected at build time by deploy-stack.sh.
export const API_CONFIG = Object.freeze({
  apiEndpoint: process.env.REACT_APP_API_ENDPOINT || '',
  websocketEndpoint: process.env.REACT_APP_WEBSOCKET_ENDPOINT || '',
  simulatorEndpoint: process.env.REACT_APP_SIMULATOR_ENDPOINT || ''
});

export function getApiConfig() {
  return API_CONFIG;
}
