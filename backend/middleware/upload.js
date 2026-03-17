const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const config = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.path);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
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
