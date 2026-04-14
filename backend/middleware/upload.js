const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const AppError = require('../utils/AppError');
const config = require('../config');

const hasCloudinaryConfig =
  Boolean(config.cloudinary.cloudName) &&
  Boolean(config.cloudinary.apiKey) &&
  Boolean(config.cloudinary.apiSecret);

if (!hasCloudinaryConfig) {
  throw new Error('Cloudinary config missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
}

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: config.cloudinary.folder || 'communex',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    resource_type: 'image',
  },
});

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
