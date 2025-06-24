// server/middleware/errorHandler.js
// ------------------------------------------------------------------

/* ---------- Custom error classes ---------- */
export class ValidationError extends Error {
  constructor(message = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.errors = {};           // field‑level errors
  }

  addValidationError(field, message) {
    this.errors[field] = message;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      errors: this.errors,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

export class AuthError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/* ---------- Process‑level error hooks ---------- */
export function setupGlobalErrorHandlers() {
  // Synchronous exceptions
  process.on('uncaughtException', err => {
    console.error('❌  Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    console.error('Message:', err.message);
    console.error('Name:', err.name);
    // Never exit in development to help with debugging
    // if (process.env.NODE_ENV === 'production') {
    //   process.exit(1);
    // }
  });

  // Rejected promises with no .catch()
  process.on('unhandledRejection', reason => {
    console.error('❌  Unhandled Rejection:', reason);
    if (reason && reason.stack) {
      console.error('Stack:', reason.stack);
    }
    if (reason && reason.message) {
      console.error('Message:', reason.message);
    }
    // Never exit in development to help with debugging
    // if (process.env.NODE_ENV === 'production') {
    //   process.exit(1);
    // }
  });
}

/* ---------- Express middle‑wares ---------- */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ValidationError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ValidationError(message);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req, res, next) => {
  next(new NotFoundError(`Not Found – ${req.originalUrl}`));
};

export const handleRateLimitError = (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      type: 'RateLimitError',
      message: 'Too many requests, please try again later.'
    }
  });
};
