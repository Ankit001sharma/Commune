const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    let token;

    console.log('AUTH HEADER:', req.headers.authorization);

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Accept lowercase bearer as a safe fallback.
    if (!token && req.headers.authorization) {
      const [scheme, value] = req.headers.authorization.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) {
        token = value;
      }
    }

    console.log('TOKEN:', token);

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Not authorized. No token provided.',
      });
    }

    const jwtSecret = config.jwt.secret;
    if (!jwtSecret) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired token',
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    console.log('DECODED:', decoded);

    if (!decoded?.id) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired token',
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired token',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = await User.findById(decoded.id);
    }
  } catch (_) {
    // Silently continue without user
  }
  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.isAdmin ? 'admin' : 'user')) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { protect, optionalAuth, restrictTo };
