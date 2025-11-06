/**
 * Utility function to generate URL-friendly slugs from text
 * Converts text to lowercase, removes special characters, and replaces spaces with hyphens
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
}

/**
 * Generate a unique slug from recipe title
 * If slug already exists, appends a number (e.g., recipe-title-2)
 */
export function generateUniqueSlug(title: string, existingSlugs: string[] = []): string {
  const baseSlug = slugify(title);
  
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }
  
  // If slug exists, append a number
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }
  
  return uniqueSlug;
}

