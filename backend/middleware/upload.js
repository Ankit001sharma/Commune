const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const AppError = require('../utils/AppError');
const config = require('../config');

// Check if Cloudinary is properly configured
const isCloudinaryConfigured =
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret &&
  !config.cloudinary.cloudName.includes('your_cloud_name');

let storage;

if (isCloudinaryConfigured) {
  console.log('[Upload] Using Cloudinary storage');
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: config.cloudinary.folder || 'communex',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      resource_type: 'image',
    },
  });
} else {
  console.log('[Upload] Cloudinary config missing or placeholder. Falling back to local storage.');
  
  const uploadDir = path.isAbsolute(config.upload.path)
    ? config.upload.path
    : path.resolve(__dirname, '../../', config.upload.path);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new AppError('Only image files (jpeg, jpg, png, gif, webp) are allowed.', 400));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 5,
  },
});

module.exports = upload;
