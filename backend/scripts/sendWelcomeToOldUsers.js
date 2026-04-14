const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');
const { sendWelcomeEmail } = require('../services/emailService');

const run = async () => {
  await mongoose.connect(config.mongoUri);

  const users = await User.find({
    isVerified: true,
    welcomeEmailSent: false,
  });

  console.log(`Found ${users.length} verified users pending welcome email.`);

  let sentCount = 0;
  let failedCount = 0;

  for (const user of users) {
    try {
      await sendWelcomeEmail(user.email, user.firstName);
      user.welcomeEmailSent = true;
      await user.save({ validateBeforeSave: false });
      sentCount += 1;
      console.log(`Sent to ${user.email}`);
    } catch (err) {
      failedCount += 1;
      console.error(`Failed for ${user.email}: ${err.message}`);
    }
  }

  console.log(`Done. Sent: ${sentCount}, Failed: ${failedCount}`);
};

run()
  .catch((err) => {
    console.error(`Script error: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {
      // Ignore disconnect errors on shutdown.
    }
  });
