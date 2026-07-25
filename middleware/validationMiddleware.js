import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

// Helper to handle validation results in strict field order
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first validation error message to preserve sequential field error priority
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

export const validateRegister = [
  // 1. Username Validation (Format + DB Existence Check)
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
    .custom(async (value) => {
      const userExists = await User.findOne({ username: value });
      if (userExists) {
        throw new Error('Username is already taken. Please choose a different username.');
      }
      return true;
    }),
  
  // 2. Email Validation (Format + DB Existence Check)
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .custom(async (value) => {
      const emailExists = await User.findOne({ email: value });
      if (emailExists) {
        throw new Error('An account with this email address already exists.');
      }
      return true;
    }),
  
  // 3. Password Validation (Format Check)
  body('password')
    .custom((value) => {
      if (!value) throw new Error('Password is required');
      
      const hasLength = value.length >= 6;
      const hasLower = /[a-z]/.test(value);
      const hasUpper = /[A-Z]/.test(value);
      const hasSpecial = /[\W_]/.test(value);
      
      if (!hasLength || !hasLower || !hasUpper || !hasSpecial) {
        throw new Error('Password must be at least 6 characters and include a lowercase letter, an uppercase letter, and a special character.');
      }
      return true;
    }),
  
  body('fullName')
    .optional()
    .trim(),
    
  handleValidationErrors
];

export const validateLogin = [
  body().custom((_, { req }) => {
    const identifier = req.body.loginId || req.body.email || req.body.username;
    if (!identifier || !identifier.trim()) {
      throw new Error('Please enter your username or email address');
    }
    return true;
  }),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
    
  handleValidationErrors
];
