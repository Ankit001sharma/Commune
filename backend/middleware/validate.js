const { body, param, validationResult } = require('express-validator');
const { validateRollAndDepartment, normalizeDepartment } = require('../utils/rollValidation');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      message: errors.array().map(err => err.msg).join('. ')
    });
  }
  next();
};

const validateRegister = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('rollNumber').trim().toUpperCase().custom((value, { req }) => {
    const department = normalizeDepartment(req.body.department);
    const result = validateRollAndDepartment(value, department);
    if (!result.isValid) {
      throw new Error(result.message);
    }
    // Update the request body with normalized values
    req.body.rollNumber = result.normalizedRoll;
    req.body.department = result.expectedDepartment;
    return true;
  }),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('phone').trim().isLength({ min: 10, max: 10 }).isNumeric().withMessage('Phone number must be exactly 10 digits'),
  body('year').optional().isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must include at least one special character'),
  validate
];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const validateListing = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  validate
];

const validateService = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').notEmpty().withMessage('Category is required'),
  validate
];

const validateSaveItem = [
  body('itemId').isMongoId().withMessage('Valid itemId is required'),
  body('itemType').trim().toLowerCase().isIn(['listing', 'service', 'post']).withMessage('itemType must be listing, service, or post'),
  validate
];

const validatePost = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('content').trim().isLength({ min: 10 }).withMessage('Content must be at least 10 characters'),
  body('type').notEmpty().withMessage('Post type is required'),
  validate
];

const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  validate
];

module.exports = {
  validateRegister,
  validateLogin,
  validateListing,
  validateService,
  validateSaveItem,
  validatePost,
  validateObjectId,
};
