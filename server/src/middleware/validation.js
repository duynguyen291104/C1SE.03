const { body, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

// Register validation
const registerValidation = [
  body('email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/[A-Z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ hoa')
    .matches(/[a-z]/).withMessage('Mật khẩu phải có ít nhất 1 chữ thường')
    .matches(/[0-9]/).withMessage('Mật khẩu phải có ít nhất 1 số')
    .matches(/[@$!%*?&#]/).withMessage('Mật khẩu phải có ít nhất 1 ký tự đặc biệt'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải từ 2-100 ký tự'),
  handleValidationErrors
];

// Login validation
const loginValidation = [
  body('email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc'),
  handleValidationErrors
];

// Profile update validation
const profileUpdateValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải từ 2-100 ký tự'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio không được quá 500 ký tự'),
  body('avatarUrl')
    .optional()
    .isURL().withMessage('URL avatar không hợp lệ'),
  handleValidationErrors
];

// Role assignment validation
const roleAssignmentValidation = [
  body('role')
    .isIn(['student', 'teacher']).withMessage('Vai trò phải là student hoặc teacher'),
  handleValidationErrors
];

// Banned word validation
const bannedWordValidation = [
  body('word')
    .trim()
    .notEmpty().withMessage('Từ cấm không được để trống')
    .isLength({ min: 2, max: 50 }).withMessage('Từ cấm phải từ 2-50 ký tự'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Mức độ phải là low, medium hoặc high'),
  body('category')
    .optional()
    .isIn(['profanity', 'hate-speech', 'spam', 'other']).withMessage('Danh mục không hợp lệ'),
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  profileUpdateValidation,
  roleAssignmentValidation,
  bannedWordValidation,
  handleValidationErrors
};
