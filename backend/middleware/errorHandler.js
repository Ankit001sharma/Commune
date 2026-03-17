const AppError = require('../utils/AppError');

const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFields = (err) => {
  const value = Object.keys(err.keyValue).join(', ');
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message, stack: err.stack };

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateFields(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);

  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      status,
      message: error.message || 'Internal Server Error',
      error: error,
      stack: error.stack,
    });
  }

  if (error.isOperational) {
    return res.status(statusCode).json({
      status,
      message: error.message,
    });
  }

  console.error('ERROR:', error);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong.',
  });
};

module.exports = errorHandler;
