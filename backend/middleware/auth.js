const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    let token;

    console.log("AUTH HEADER:", req.headers.authorization);

    // Extract Bearer token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Fallback for lowercase bearer
    if (!token && req.headers.authorization) {
      const [scheme, value] = req.headers.authorization.split(' ');

      if (scheme?.toLowerCase() === 'bearer' && value) {
        token = value;
      }
    }

    console.log("TOKEN:", token);

    // No token
    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Not authorized. No token provided.',
      });
    }

    const jwtSecret = config.jwt.secret;

    if (!jwtSecret) {
      return res.status(500).json({
        status: 'fail',
        message: 'JWT secret missing in config.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);

    console.log("DECODED:", decoded);

    // Support multiple payload formats
    const userId = decoded?.id || decoded?._id || decoded?.userId;

    console.log("USER ID:", userId);

    if (!userId) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token payload.',
      });
    }

    // Find user
    const user = await User.findById(userId);

    console.log("FOUND USER:", user?._id);

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found.',
      });
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);

    return res.status(401).json({
      status: 'fail',
      message: err.message || 'Invalid or expired token',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);

      const userId =
        decoded?.id || decoded?._id || decoded?.userId;

      if (userId) {
        req.user = await User.findById(userId);
      }
    }
  } catch (_) {
    // Ignore auth failure in optional auth
  }

  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.isAdmin ? 'admin' : 'user')) {
      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403
        )
      );
    }

    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  restrictTo,
};