import Joi from 'joi';
import { ValidationError } from './errorHandler.js';

/**
 * Generic validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[source], { 
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: true // For cases where we want to allow additional fields
      });
      
      if (error) {
        const validationError = new ValidationError('Validation failed');
        
        error.details.forEach(detail => {
          const field = detail.path.join('.');
          const message = detail.message.replace(/"/g, '');
          validationError.addValidationError(field, message);
        });
        
        return next(validationError);
      }
      
      req[source] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Course Creation/Update Schema
export const courseSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().min(20).max(1000).required(),
  category: Joi.string().required().valid('frontend', 'backend', 'devops'), // Add allowed categories
  level: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),

  instructorId: Joi.number().required()  // Keep this as number
});

// Course Publish Status Schema
export const publishStatusSchema = Joi.object({
  action: Joi.string().valid('publish', 'unpublish').required().messages({
    'any.only': 'Action must be either publish or unpublish',
    'any.required': 'Action is required'
  })
});

// Announcement Schema
export const announcementSchema = Joi.object({
  title: Joi.string().min(5).max(100).required().messages({
    'string.min': 'Title must be at least {#limit} characters',
    'string.max': 'Title cannot exceed {#limit} characters',
    'any.required': 'Title is required'
  }),
  message: Joi.string().min(10).max(1000).required().messages({
    'string.min': 'Message must be at least {#limit} characters',
    'string.max': 'Message cannot exceed {#limit} characters',
    'any.required': 'Message is required'
  })
});

// Export specific validation middlewares
export const validateCourse = validateRequest(courseSchema);
export const validatePublishStatus = validateRequest(publishStatusSchema);
export const validateAnnouncement = validateRequest(announcementSchema);