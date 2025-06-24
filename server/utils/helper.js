import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import dotenv from 'dotenv';
import QuizModel from '../models/quizModel.js';
import LessonModel from '../models/lessonModel.js';
import ModuleModel from '../models/moduleModel.js';
import CourseModel from '../models/courseModel.js';
import AssignmentModel from '../models/assignmentModel.js';
dotenv.config();
// Token generation and verification functions
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

const generateRefreshToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
};

const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return null;
  }
};

// Password handling functions
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

const hashPassword = async (password) => {
  return await bcrypt.hash(
    password,
    parseInt(process.env.BCRYPT_SALT_ROUNDS || 10)
  );
};

const updatePassword = async (userId, newPassword) => {
  const hashedPassword = await hashPassword(newPassword);
  await query(
    `UPDATE users SET password = $1 WHERE id = $2`,
    [hashedPassword, userId]
  );
};

// Security-related functions
const generatePasswordResetToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_RESET_SECRET,
    { expiresIn: process.env.JWT_RESET_EXPIRES_IN || "1h" }
  );
};

const verifyPasswordResetToken = (token) => {
  return verifyToken(token, process.env.JWT_RESET_SECRET);
};

// Add verification token functions
const generateVerificationToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_VERIFICATION_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_VERIFICATION_EXPIRES_IN || "24h" }
  );
};

const verifyVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_VERIFICATION_SECRET || process.env.JWT_SECRET);
    return decoded.id;
  } catch (err) {
    console.error('Verification token verification failed:', err.message);
    return null;
  }
};

// Response and user handling
const createResponse = (success, message, data = null, error = null) => {
  return {
    success,
    message,
    data,
    error
  };
};

const sanitizeUser = (user) => {
  if (!user) return null;
  
  const { password, refreshToken, resetToken, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Middleware helper
const authenticateToken = (requiredRole = null) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json(createResponse(false, 'Access token required'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(403).json(createResponse(false, 'Invalid or expired token'));
      }

      // Check role if required
      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json(createResponse(false, 'Insufficient permissions'));
      }

      // Attach user to request
      req.user = decoded;
      next();
    } catch (err) {
      console.error('Authentication error:', err);
      return res.status(500).json(createResponse(false, 'Authentication failed'));
    }
  };
};

// Course hierarchy navigation utilities
/**
 * Get course hierarchy from quiz ID
 * @param {number} quiz_id - Quiz ID
 * @returns {Object|null} Object containing quiz, lesson, module, course or null if not found
 */
const getCourseFromQuizId = async (quiz_id) => {
  try {
    const quiz = await QuizModel.findById(quiz_id);
    if (!quiz) return null;
    
    const lesson = await LessonModel.findById(quiz.lesson_id);
    if (!lesson) return null;
    
    const module = await ModuleModel.findById(lesson.module_id);
    if (!module) return null;
    
    const course = await CourseModel.findById(module.course_id);
    if (!course) return null;
    
    return { quiz, lesson, module, course };
  } catch (error) {
    console.error('Error getting course from quiz ID:', error);
    return null;
  }
};

/**
 * Get course hierarchy from assignment ID
 * @param {number} assignment_id - Assignment ID
 * @returns {Object|null} Object containing assignment, lesson, module, course or null if not found
 */
const getCourseFromAssignmentId = async (assignment_id) => {
  try {
    const assignment = await AssignmentModel.findById(assignment_id);
    if (!assignment) return null;
    
    const lesson = await LessonModel.findById(assignment.lesson_id);
    if (!lesson) return null;
    
    const module = await ModuleModel.findById(lesson.module_id);
    if (!module) return null;
    
    const course = await CourseModel.findById(module.course_id);
    if (!course) return null;
    
    return { assignment, lesson, module, course };
  } catch (error) {
    console.error('Error getting course from assignment ID:', error);
    return null;
  }
};

/**
 * Get course hierarchy from lesson ID
 * @param {number} lesson_id - Lesson ID
 * @returns {Object|null} Object containing lesson, module, course or null if not found
 */
const getCourseFromLessonId = async (lesson_id) => {
  try {
    const lesson = await LessonModel.findById(lesson_id);
    if (!lesson) return null;
    
    const module = await ModuleModel.findById(lesson.module_id);
    if (!module) return null;
    
    const course = await CourseModel.findById(module.course_id);
    if (!course) return null;
    
    return { lesson, module, course };
  } catch (error) {
    console.error('Error getting course from lesson ID:', error);
    return null;
  }
};

// Authorization utilities
/**
 * Check if user is authorized as instructor or admin for a course
 * @param {Object} course - Course object
 * @param {Object} user - User object from req.user
 * @returns {boolean} True if authorized, false otherwise
 */
const authorizeInstructorOrAdmin = (course, user) => {
  if (!user || !course) return false;
  
  const isAdmin = user.role === 'admin';
  const isInstructor = user.id === course.instructor_id;
  
  return isAdmin || isInstructor;
};

/**
 * Check if user is authorized as admin
 * @param {Object} user - User object from req.user
 * @returns {boolean} True if admin, false otherwise
 */
const authorizeAdmin = (user) => {
  return user && user.role === 'admin';
};

/**
 * Check if user is authorized as instructor
 * @param {Object} course - Course object
 * @param {Object} user - User object from req.user
 * @returns {boolean} True if instructor, false otherwise
 */
const authorizeInstructor = (course, user) => {
  return user && course && user.id === course.instructor_id;
};

// Input validation utilities
/**
 * Validate required fields with trimming
 * @param {Object} fields - Object with field names as keys and values to validate
 * @returns {Object} Object with isValid boolean and missing array
 */
const validateRequiredFields = (fields) => {
  const missing = [];
  
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      missing.push(fieldName);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing
  };
};

/**
 * Sanitize string fields by trimming whitespace
 * @param {Object} obj - Object to sanitize
 * @param {Array} fields - Array of field names to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeStringFields = (obj, fields) => {
  const sanitized = { ...obj };
  
  fields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitized[field].trim();
    }
  });
  
  return sanitized;
};

// Error handling utilities
/**
 * Enhanced error logging with context
 * @param {string} operation - Operation being performed
 * @param {Error} error - Error object
 * @param {Object} context - Additional context (user, request info, etc.)
 */
const logError = (operation, error, context = {}) => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    operation,
    message: error.message,
    stack: error.stack,
    ...context
  };
  
  console.error(`[${timestamp}] ERROR in ${operation}:`, errorInfo);
};

/**
 * Create standardized error response
 * @param {string} operation - Operation that failed
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 * @returns {Object} Standardized error response
 */
const createErrorResponse = (operation, error, context = {}) => {
  logError(operation, error, context);
  
  return createResponse(
    false,
    error.message || `Failed to ${operation}`,
    null,
    process.env.NODE_ENV === 'development' ? error.stack : undefined
  );
};

// Batch operation utilities
/**
 * Get best attempts for multiple quizzes for a user
 * @param {number} user_id - User ID
 * @param {Array} quiz_ids - Array of quiz IDs
 * @returns {Object} Object with quiz_id as key and best attempt as value
 */
const getBestAttemptsForQuizzes = async (user_id, quiz_ids) => {
  try {
    if (!quiz_ids || quiz_ids.length === 0) return {};
    
    const attempts = await QuizModel.getBestAttemptsForUser(user_id, quiz_ids);
    
    // Convert array to object for easy lookup
    const attemptsMap = {};
    attempts.forEach(attempt => {
      attemptsMap[attempt.quiz_id] = attempt;
    });
    
    return attemptsMap;
  } catch (error) {
    console.error('Error getting best attempts for quizzes:', error);
    return {};
  }
};

// Export all utilities
export {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  updatePassword,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateVerificationToken,
  verifyVerificationToken,
  createResponse,
  sanitizeUser,
  authenticateToken,
  // New utilities
  getCourseFromQuizId,
  getCourseFromAssignmentId,
  getCourseFromLessonId,
  authorizeInstructorOrAdmin,
  authorizeAdmin,
  authorizeInstructor,
  validateRequiredFields,
  sanitizeStringFields,
  logError,
  createErrorResponse,
  getBestAttemptsForQuizzes
};