/**
 * Centralized Error Handling for LD Crimson Blood
 * Provides consistent error handling with logging, user notifications, and optional recovery
 */

import { logger } from './crimson-logger.js';
import { MODULE_ID } from './constants.js';

/**
 * Error severity levels
 */
export const ErrorSeverity =  {
  CRITICAL: 'critical',    // System-breaking errors, requires user attention
  ERROR: 'error',          // Significant errors, user should know
  WARNING: 'warning',      // Issues that don't break functionality
  INFO: 'info'             // Informational, logged but not notified
};

/**
 * Standard error handler
 * @param {Error} error - The error object
 * @param {Object} options - Handler options
 * @param {string} options.context - Description of what was happening when error occurred
 * @param {string} options.severity - Error severity level
 * @param {boolean} options.notify - Whether to show UI notification (default: true)
 * @param {boolean} options.log - Whether to log to console (default: true)
 * @param {Function} options.fallback - Optional fallback function to execute
 * @param {Object} options.data - Optional data to include in logs
 */
export function handleError(error, options = {}) {
  const  {
    context = 'Unknown operation',
    severity = ErrorSeverity.ERROR,
    notify = true,
    log = true,
    fallback = null,
    data = null
  } = options;

  // Log the error
  if (log) {
    const errorMessage = `${context} failed: ${error.message}`;
    const errorData = data ? { error, data } : error;

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL: ${errorMessage}`, errorData);
        break;
      case ErrorSeverity.ERROR:
        logger.error(errorMessage, errorData);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(errorMessage, errorData);
        break;
      case ErrorSeverity.INFO:
        logger.log(errorMessage, errorData);
        break;
    }
  }

  // Show user notification
  if (notify && typeof ui !== 'undefined' && ui.notifications) {
    const userMessage = severity === ErrorSeverity.CRITICAL
      ? `${context} failed critically. Check console for details.`
      : `${context} failed. ${error.message}`;

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        ui.notifications.error(userMessage);
        break;
      case ErrorSeverity.WARNING:
        ui.notifications.warn(userMessage);
        break;
      case ErrorSeverity.INFO:
        ui.notifications.info(userMessage);
        break;
    }
  }

  // Execute fallback if provided
  if (typeof fallback === 'function') {
    try  {
      return fallback(error);
    } catch (fallbackError) {
      logger.error(`Fallback for "${context}" also failed`, fallbackError);
    }
  }

  return null;
}

/**
 * Async error handler wrapper
 * Wraps an async function with standardized error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options (same as handleError)
 * @returns {Function} Wrapped function
 */
export function asyncHandler(fn, options = {}) {
  return async function(...args) {
    try  {
      return await fn.apply(this, args);
    } catch (error) {
      return handleError(error, options);
    }
  };
}

/**
 * Safe execution wrapper
 * Executes a function with error handling, doesn't rethrow
 * @param {Function} fn - Function to execute
 * @param {Object} options - Error handling options
 * @returns {*} Function result or null on error
 */
export function safeExecute(fn, options = {}) {
  try  {
    const result = fn();
    return result instanceof Promise
      ? result.catch(error => handleError(error, options))
      : result;
  } catch (error) {
    return handleError(error, options);
  }
}

/**
 * Retry wrapper for functions that may fail transiently
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum retry attempts (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 100)
 * @param {Function} options.shouldRetry - Function to determine if should retry (default: always)
 * @returns {Promise<*>} Function result
 */
export async function retryOnError(fn, options = {}) {
  const  {
    maxAttempts = 3,
    delay = 100,
    shouldRetry = () => true,
    context = 'Retry operation'
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try  {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      logger.warn(`${context} failed (attempt ${attempt}/${maxAttempts}), retrying...`, error);

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Creates a context-specific error handler
 * @param {string} defaultContext - Default context for errors
 * @param {Object} defaultOptions - Default options for error handling
 * @returns {Function} Error handler function
 */
export function createErrorHandler(defaultContext, defaultOptions = {}) {
  return (error, contextOptions = {}) =>  {
    return handleError(error,  {
      context: defaultContext,
      ...defaultOptions,
      ...contextOptions
    });
  };
}

/**
 * Validation error helper
 * Throws a standardized validation error
 * @param {string} message - Error message
 * @param {Object} data - Invalid data
 */
export function validationError(message, data = null) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.data = data;
  throw error;
}

/**
 * Check if error is a specific type
 * @param {Error} error - Error to check
 * @param {string} errorName - Error type name
 * @returns {boolean}
 */
export function isErrorType(error, errorName) {
  return error?.name === errorName;
}

