import { body, param, query } from 'express-validator';

/**
 * Input sanitization middleware
 * Sanitizes user input to prevent XSS attacks
 */

/**
 * Sanitize string input
 * Removes HTML tags and escapes special characters
 */
export const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  
  // Remove HTML tags
  const withoutHtml = value.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  return withoutHtml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitize recipe title
 */
export const sanitizeRecipeTitle = [
  body('recipe.title').customSanitizer(sanitizeString),
  body('title').customSanitizer(sanitizeString),
];

/**
 * Sanitize recipe description
 */
export const sanitizeRecipeDescription = [
  body('recipe.description').optional().customSanitizer(sanitizeString),
  body('description').optional().customSanitizer(sanitizeString),
];

/**
 * Sanitize search query
 */
export const sanitizeSearchQuery = [
  body('query').customSanitizer(sanitizeString),
  query('query').customSanitizer(sanitizeString),
];

/**
 * Sanitize URL parameters
 */
export const sanitizeUrlParams = [
  param('id').customSanitizer((value) => {
    // Only allow UUID format
    if (typeof value !== 'string') return value;
    return value.replace(/[^a-f0-9-]/gi, '');
  }),
  param('slug').customSanitizer((value) => {
    // Only allow alphanumeric, hyphens, and underscores
    if (typeof value !== 'string') return value;
    return value.replace(/[^a-z0-9-_]/gi, '');
  }),
];

/**
 * Sanitize all recipe fields
 */
export const sanitizeRecipe = [
  ...sanitizeRecipeTitle,
  ...sanitizeRecipeDescription,
  ...sanitizeSearchQuery,
];

