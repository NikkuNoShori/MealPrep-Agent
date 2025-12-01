import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Recipe creation validation rules
 */
export const validateRecipeCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('ingredients')
    .isArray()
    .withMessage('Ingredients must be an array')
    .notEmpty()
    .withMessage('At least one ingredient is required'),
  
  body('ingredients.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Ingredient name cannot be empty'),
  
  body('instructions')
    .isArray()
    .withMessage('Instructions must be an array')
    .notEmpty()
    .withMessage('At least one instruction is required'),
  
  body('instructions.*')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Instruction cannot be empty'),
  
  body('prepTime')
    .optional()
    .isInt({ min: 0, max: 10080 }) // Max 7 days in minutes
    .withMessage('Prep time must be a positive integer (minutes)'),
  
  body('prep_time')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Prep time must be a positive integer (minutes)'),
  
  body('cookTime')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Cook time must be a positive integer (minutes)'),
  
  body('cook_time')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Cook time must be a positive integer (minutes)'),
  
  body('servings')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Servings must be between 1 and 100'),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters'),
  
  body('dietary_tags')
    .optional()
    .isArray()
    .withMessage('Dietary tags must be an array'),
  
  body('sourceUrl')
    .optional()
    .isURL()
    .withMessage('Source URL must be a valid URL'),
  
  body('source_url')
    .optional()
    .isURL()
    .withMessage('Source URL must be a valid URL'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  handleValidationErrors,
];

/**
 * Recipe update validation rules
 */
export const validateRecipeUpdate = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('ingredients')
    .optional()
    .isArray()
    .withMessage('Ingredients must be an array'),
  
  body('instructions')
    .optional()
    .isArray()
    .withMessage('Instructions must be an array'),
  
  body('prepTime')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Prep time must be a positive integer (minutes)'),
  
  body('prep_time')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Prep time must be a positive integer (minutes)'),
  
  body('cookTime')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Cook time must be a positive integer (minutes)'),
  
  body('cook_time')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Cook time must be a positive integer (minutes)'),
  
  body('servings')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Servings must be between 1 and 100'),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  
  handleValidationErrors,
];

/**
 * Recipe ID parameter validation
 */
export const validateRecipeId = [
  param('id')
    .isUUID()
    .withMessage('Recipe ID must be a valid UUID'),
  handleValidationErrors,
];

/**
 * Search query validation
 */
export const validateSearchQuery = [
  query('query')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Search query must be between 1 and 500 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  handleValidationErrors,
];

/**
 * RAG search validation
 */
export const validateRAGSearch = [
  body('query')
    .trim()
    .notEmpty()
    .withMessage('Query is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be between 1 and 500 characters'),
  
  body('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('searchType')
    .optional()
    .isIn(['semantic', 'text', 'hybrid'])
    .withMessage('Search type must be semantic, text, or hybrid'),
  
  handleValidationErrors,
];

