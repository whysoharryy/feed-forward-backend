/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // Custom AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: err.details.map(d => d.message).join(', '),
    });
  }

  // Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    const statusCode = err.code === 'auth/user-not-found' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Default server error
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
};

module.exports = errorHandler;
