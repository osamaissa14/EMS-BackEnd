/**
 * Logger utility for consistent logging across the application
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// ANSI color codes for console output
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m'
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
};

/**
 * Write log to file
 * @param {string} level - Log level
 * @param {string} message - Log message
 */
const writeToFile = (level, message) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(logsDir, `${today}.log`);
    const logMessage = formatLogMessage(level, message) + '\n';
    
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
};

/**
 * Log error message
 * @param {string|Error} message - Error message or Error object
 * @param {Object} [metadata] - Additional metadata
 */
export const logError = (message, metadata = {}) => {
  const level = LOG_LEVELS.ERROR;
  let logMessage;
  
  if (message instanceof Error) {
    logMessage = `${message.message}\n${message.stack}`;
    metadata.name = message.name;
  } else {
    logMessage = message;
  }
  
  if (Object.keys(metadata).length > 0) {
    logMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
  }
  
  // Console output with color
  console.error(`${COLORS.RED}${formatLogMessage(level, logMessage)}${COLORS.RESET}`);
  
  // File output
  if (process.env.NODE_ENV !== 'test') {
    writeToFile(level, logMessage);
  }
};

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {Object} [metadata] - Additional metadata
 */
export const logWarn = (message, metadata = {}) => {
  const level = LOG_LEVELS.WARN;
  let logMessage = message;
  
  if (Object.keys(metadata).length > 0) {
    logMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
  }
  
  // Console output with color
  console.warn(`${COLORS.YELLOW}${formatLogMessage(level, logMessage)}${COLORS.RESET}`);
  
  // File output
  if (process.env.NODE_ENV !== 'test') {
    writeToFile(level, logMessage);
  }
};

/**
 * Log info message
 * @param {string} message - Info message
 * @param {Object} [metadata] - Additional metadata
 */
export const logInfo = (message, metadata = {}) => {
  const level = LOG_LEVELS.INFO;
  let logMessage = message;
  
  if (Object.keys(metadata).length > 0) {
    logMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
  }
  
  // Console output with color
  console.info(`${COLORS.GREEN}${formatLogMessage(level, logMessage)}${COLORS.RESET}`);
  
  // File output
  if (process.env.NODE_ENV !== 'test' && process.env.LOG_LEVEL !== 'error') {
    writeToFile(level, logMessage);
  }
};

/**
 * Log debug message (only in development)
 * @param {string} message - Debug message
 * @param {Object} [metadata] - Additional metadata
 */
export const logDebug = (message, metadata = {}) => {
  // Only log debug in development or if explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG !== 'true') {
    return;
  }
  
  const level = LOG_LEVELS.DEBUG;
  let logMessage = message;
  
  if (Object.keys(metadata).length > 0) {
    logMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
  }
  
  // Console output with color
  console.debug(`${COLORS.BLUE}${formatLogMessage(level, logMessage)}${COLORS.RESET}`);
  
  // File output (only if debug logging is explicitly enabled)
  if (process.env.DEBUG === 'true') {
    writeToFile(level, logMessage);
  }
};

/**
 * Log HTTP request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in milliseconds
 */
export const logHttpRequest = (req, res, responseTime) => {
  const { method, originalUrl, ip } = req;
  const statusCode = res.statusCode;
  const userAgent = req.get('user-agent') || 'Unknown';
  
  const logLevel = statusCode >= 500 ? LOG_LEVELS.ERROR : 
                  statusCode >= 400 ? LOG_LEVELS.WARN : 
                  LOG_LEVELS.INFO;
  
  const message = `${method} ${originalUrl} ${statusCode} ${responseTime}ms - ${ip} - ${userAgent}`;
  
  switch (logLevel) {
    case LOG_LEVELS.ERROR:
      logError(message);
      break;
    case LOG_LEVELS.WARN:
      logWarn(message);
      break;
    default:
      logInfo(message);
  }
};

export default {
  logError,
  logWarn,
  logInfo,
  logDebug,
  logHttpRequest
};