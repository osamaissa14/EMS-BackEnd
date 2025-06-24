// Export all middleware components for easier importing
import { authenticateToken } from './auth.js';
import { hasRole as authorizeRoles } from './admin.js';
import { validateRequest } from './validation.js';
import { errorHandler } from './errorHandler.js';

export {
  authenticateToken,
  authorizeRoles,
  validateRequest,
  errorHandler
};