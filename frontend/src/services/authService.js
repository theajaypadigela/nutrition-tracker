// Backward-compatible shim.
//
// The unauthorized/logout handler now lives on the API client itself
// (registerUnauthorizedHandler in ../api/client). This module is kept so existing
// importers of `setLogoutHandler` keep working; prefer importing
// registerUnauthorizedHandler from '../api/client' directly in new code.
import { registerUnauthorizedHandler } from '../api/client';

export const setLogoutHandler = registerUnauthorizedHandler;
