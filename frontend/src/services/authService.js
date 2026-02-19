// Global logout handler that can be set by the AuthContext
// This allows the API client to trigger logout without circular dependencies
let logoutHandler = null;

export const setLogoutHandler = (handler) => {
  logoutHandler = handler;
};

export { logoutHandler };
