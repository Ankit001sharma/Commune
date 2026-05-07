const path = require('path');

/**
 * Normalizes a file path to a URL-friendly format.
 * If it's already a full URL (Cloudinary), it returns it as is.
 * If it's a local path, it converts it to a relative URL starting with /uploads.
 */
const normalizeFilePath = (filePath) => {
  if (!filePath) return '';

  // If it's already a URL, return it
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  // Handle local disk storage paths
  // Multer diskStorage provides absolute paths, we want relative to the root
  // The 'uploads' directory is served at /uploads
  
  // Find the 'uploads' part of the path
  const normalizedPath = filePath.replace(/\\/g, '/'); // Convert windows backslashes
  const uploadsIndex = normalizedPath.indexOf('uploads/');
  
  if (uploadsIndex !== -1) {
    return '/' + normalizedPath.substring(uploadsIndex);
  }

  // Fallback: if we can't find 'uploads/', just return the filename part if it's in the uploads dir
  const filename = path.basename(filePath);
  return `/uploads/${filename}`;
};

module.exports = { normalizeFilePath };
