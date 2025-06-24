import UserModel from '../models/usermodel.js';
import { AuthError, ForbiddenError } from './errorHandler.js';
import { logError } from '../utils/logger.js';

/**
 * Middleware to check if the user has admin role
 * This should be used after authentication middleware
 */
export const isAdmin = (req, res, next) => {
  try {
    // Check if user exists in request (set by authentication middleware)
    if (!req.user) {
      return next(new AuthError('Authentication required before checking admin privileges'));
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return next(new ForbiddenError('Admin privileges required to access this resource'));
    }

    // User is admin, proceed to next middleware
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has specific roles
 * @param {Array|String} roles - Array of allowed roles or a single role string
 */
export const hasRole = (roles = []) => {
  return (req, res, next) => {
    try {
      // Convert string to array if single role is provided
      if (typeof roles === 'string') {
        roles = [roles];
      }
      
      // Check if user exists in request
      if (!req.user) {
        return next(new AuthError('Authentication required before checking role permissions'));
      }

      // Check if user has a role assigned
      if (!req.user.role) {
        return next(new ForbiddenError('User has no role assigned'));
      }

      // Check if user's role is in the allowed roles
      if (roles.length && !roles.includes(req.user.role)) {
        return next(new ForbiddenError(`Access denied: ${req.user.role} role is not authorized for this operation`));
      }

      // User has required role, proceed
      next();
    } catch (error) {
      error.status = error.status || 500;
      next(error);
    }
  };
};