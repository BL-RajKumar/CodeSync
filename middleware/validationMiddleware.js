import { body, validationResult } from 'express-validator';

// Helper to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first error message to match the frontend error handling format
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

export const validateRegister = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address'),
  
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
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
    
  handleValidationErrors
];
