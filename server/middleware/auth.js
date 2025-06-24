// server/middleware/auth.js
import jwt from 'jsonwebtoken';
import UserModel from "../models/usermodel.js";
import { 
  AuthError,
  NotFoundError,
  ForbiddenError
} from './errorHandler.js';

// Main authentication middleware
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    
    if (!authHeader) {
      throw new AuthError("No authorization header provided");
    }
    
    const token = authHeader.split(" ")[1];
    
    if (!token) {
      throw new AuthError("No token provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id);
    
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    req.user = user;
    next();
  } catch (err) {
    
    if (err.name === 'JsonWebTokenError') {
      next(new AuthError("Invalid token"));
    } else if (err.name === 'TokenExpiredError') {
      next(new AuthError("Token expired"));
    } else {
      next(err);
    }
  }
};

// Role-based authorization
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

// Specific role middlewares
export const authorizeAdmin = authorizeRoles('admin');
export const authorizeInstructor = authorizeRoles('instructor', 'admin');

export default {
  authenticateToken,
  authorizeRoles,
  authorizeAdmin,
  authorizeInstructor
};