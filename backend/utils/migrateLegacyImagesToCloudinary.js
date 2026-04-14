const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const connectDB = require('../config/database');
const config = require('../config');
const Listing = require('../models/Listing');
const Service = require('../models/Service');
const Post = require('../models/Post');
const User = require('../models/User');

const isLegacyUploadUrl = (value) => typeof value === 'string' && value.startsWith('/uploads/');

const getUploadRoot = () =>
  path.isAbsolute(config.upload.path)
    ? config.upload.path
    : path.resolve(__dirname, '..', config.upload.path);

const getLocalPathFromLegacyUrl = (legacyUrl) => {
  const filename = legacyUrl.replace('/uploads/', '');
  return path.join(getUploadRoot(), filename);
};

const uploadToCloudinary = async (legacyUrl) => {
  const localFile = getLocalPathFromLegacyUrl(legacyUrl);
  if (!fs.existsSync(localFile)) return null;

  const result = await cloudinary.uploader.upload(localFile, {
    folder: `${config.cloudinary.folder}/migrated`,
    resource_type: 'image',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const migrateImageArrayField = async (docs, fieldName) => {
  let updatedDocs = 0;
  let updatedImages = 0;
  let missingFiles = 0;

  for (const doc of docs) {
    const current = Array.isArray(doc[fieldName]) ? doc[fieldName] : [];
    let changed = false;

    for (const image of current) {
      if (!isLegacyUploadUrl(image?.url)) continue;

      const uploaded = await uploadToCloudinary(image.url);
      if (!uploaded) {
        missingFiles += 1;
        continue;
      }

      image.url = uploaded.url;
      image.thumbnail = uploaded.url;
      if (Object.prototype.hasOwnProperty.call(image.toObject?.() || image, 'publicId')) {
        image.publicId = uploaded.publicId;
      }
      changed = true;
      updatedImages += 1;
    }

    if (changed) {
      await doc.save({ validateBeforeSave: false });
      updatedDocs += 1;
    }
  }

  return { updatedDocs, updatedImages, missingFiles };
};

const migrateAvatars = async (users) => {
  let updatedUsers = 0;
  let missingFiles = 0;

  for (const user of users) {
    if (!isLegacyUploadUrl(user.avatar)) continue;

    const uploaded = await uploadToCloudinary(user.avatar);
    if (!uploaded) {
      missingFiles += 1;
      continue;
    }

    user.avatar = uploaded.url;
    await user.save({ validateBeforeSave: false });
    updatedUsers += 1;
  }

  return { updatedUsers, missingFiles };
};

const main = async () => {
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

  await connectDB();

  const [listings, services, posts, users] = await Promise.all([
    Listing.find({ 'images.url': { $regex: '^/uploads/' } }),
    Service.find({ 'images.url': { $regex: '^/uploads/' } }),
    Post.find({ 'images.url': { $regex: '^/uploads/' } }),
    User.find({ avatar: { $regex: '^/uploads/' } }),
  ]);

  const listingResult = await migrateImageArrayField(listings, 'images');
  const serviceResult = await migrateImageArrayField(services, 'images');
  const postResult = await migrateImageArrayField(posts, 'images');
  const avatarResult = await migrateAvatars(users);

  console.log('\nMigration complete:');
  console.log(`- Listings updated: ${listingResult.updatedDocs}, images migrated: ${listingResult.updatedImages}, missing files: ${listingResult.missingFiles}`);
  console.log(`- Services updated: ${serviceResult.updatedDocs}, images migrated: ${serviceResult.updatedImages}, missing files: ${serviceResult.missingFiles}`);
  console.log(`- Posts updated: ${postResult.updatedDocs}, images migrated: ${postResult.updatedImages}, missing files: ${postResult.missingFiles}`);
  console.log(`- User avatars updated: ${avatarResult.updatedUsers}, missing files: ${avatarResult.missingFiles}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exit(1);
  });