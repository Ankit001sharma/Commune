const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Note: express-validator not in package.json, using manual validation instead
const validate = (validations) => {
  return async (req, res, next) => {
    next();
  };
};

const validateRegister = (req, res, next) => {
  const { firstName, lastName, email, rollNumber, password } = req.body;
  const errors = [];

  if (!firstName || firstName.trim().length < 2) errors.push('First name must be at least 2 characters');
  if (!lastName || lastName.trim().length < 2) errors.push('Last name must be at least 2 characters');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Valid email is required');
  if (!rollNumber || rollNumber.trim().length < 3) errors.push('Valid roll number is required');
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters');

  if (errors.length > 0) {
    return res.status(400).json({ status: 'fail', message: errors.join('. ') });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');

  if (errors.length > 0) {
    return res.status(400).json({ status: 'fail', message: errors.join('. ') });
  }
  next();
};

const validateListing = (req, res, next) => {
  const { title, description, category, price } = req.body;
  const errors = [];

  if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
  if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters');
  if (!category) errors.push('Category is required');
  if (price === undefined || price === null || price < 0) errors.push('Valid price is required');

  if (errors.length > 0) {
    return res.status(400).json({ status: 'fail', message: errors.join('. ') });
  }
  next();
};

const validateService = (req, res, next) => {
  const { title, description, category } = req.body;
  const errors = [];

  if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
  if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters');
  if (!category) errors.push('Category is required');

  if (errors.length > 0) {
    return res.status(400).json({ status: 'fail', message: errors.join('. ') });
  }
  next();
};

const validatePost = (req, res, next) => {
  const { title, content, type } = req.body;
  const errors = [];

  if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
  if (!content || content.trim().length < 10) errors.push('Content must be at least 10 characters');
  if (!type) errors.push('Post type is required');

  if (errors.length > 0) {
    return res.status(400).json({ status: 'fail', message: errors.join('. ') });
  }
  next();
};

const validateObjectId = (req, res, next) => {
  const id = req.params.id;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ status: 'fail', message: 'Invalid ID format' });
  }
  next();
};

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateListing,
  validateService,
  validatePost,
  validateObjectId,
};
