const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');
const { sendOtpEmail, sendWelcomeEmail } = require('../services/emailService');

const OTP_TTL_MS = 60 * 1000;

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

exports.sendOtp = async (req, res, next) => {
  try {
    console.log('sendOtp API hit');

    const { firstName, lastName, email, rollNumber, password, department, phone, year } = req.body;

    const byEmail = await User.findOne({ email }).select('+otp +otpExpiry +otpResendCount +password');
    const byRoll = await User.findOne({ rollNumber }).select('+otp +otpExpiry +otpResendCount +password');

    if ((byEmail && byEmail.isVerified) || (byRoll && byRoll.isVerified)) {
      return next(new AppError('User with this email or roll number already exists.', 400));
    }

    if (byEmail && byRoll && byEmail._id.toString() !== byRoll._id.toString()) {
      return next(new AppError('Email or roll number is already tied to another pending account.', 400));
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_TTL_MS);

    const user = byEmail || byRoll || new User();
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.rollNumber = rollNumber;
    user.password = password;
    user.department = department;
    user.phone = phone;
    user.year = Number(year) || 1;
    user.isVerified = false;
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpResendCount = 0;

    await user.save();
    await sendOtpEmail({ to: email, firstName: firstName, otp });

    sendResponse(
      res,
      200,
      { email: email, expiresInSeconds: 60 },
      'OTP sent successfully'
    );
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const email = `${req.body.email || ''}`.trim().toLowerCase();
    const otp = `${req.body.otp || ''}`.trim();

    if (!email || !otp) {
      return next(new AppError('Email and OTP are required.', 400));
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpResendCount +welcomeEmailSent');
    if (!user) return next(new AppError('No pending signup found for this email.', 404));

    if (user.isVerified) {
      return next(new AppError('Account already verified. Please log in.', 400));
    }

    if (!user.otp || user.otp !== otp) {
      return next(new AppError('Invalid OTP.', 400));
    }

    if (!user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      return next(new AppError('OTP expired. Please resend OTP.', 400));
    }

    console.log(`OTP verified for ${user.email}`);
    console.log(`welcomeEmailSent: ${Boolean(user.welcomeEmailSent)}`);

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpResendCount = 0;

    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    user.welcomeEmailSent = Boolean(user.welcomeEmailSent);

    if (!user.welcomeEmailSent) {
      try {
        console.log(`Sending welcome email to ${user.email}`);
        await sendWelcomeEmail(user.email, user.firstName);
        user.welcomeEmailSent = true;
        await user.save({ validateBeforeSave: false });
        console.log(`Welcome email sent to ${user.email}`);
      } catch (err) {
        console.error('Welcome email failed:', err.message);
        console.error(err);
      }
    } else {
      console.log(`Welcome email already sent to ${user.email}`);
    }

    user.password = undefined;
    user.refreshToken = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;

    sendResponse(res, 200, { user, token, refreshToken }, 'Signup verified successfully');
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const email = `${req.body.email || ''}`.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpResendCount');
    if (!user) return next(new AppError('No pending signup found for this email.', 404));
    if (user.isVerified) return next(new AppError('Account already verified. Please log in.', 400));

    if ((user.otpResendCount || 0) >= 5) {
      return next(new AppError('Resend limit reached. Please wait and try again later.', 429));
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_TTL_MS);
    user.otpResendCount = (user.otpResendCount || 0) + 1;
    await user.save({ validateBeforeSave: false });

    await sendOtpEmail({ to: user.email, firstName: user.firstName, otp });

    sendResponse(res, 200, { email: user.email, expiresInSeconds: 60 }, 'OTP resent successfully');
  } catch (error) {
    next(error);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, rollNumber, password, department, year, phone } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { rollNumber }] });
    if (existingUser) {
      return next(new AppError('User with this email or roll number already exists.', 400));
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      rollNumber,
      password,
      department,
      year,
      phone,
    });

    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    user.password = undefined;
    user.refreshToken = undefined;

    sendResponse(res, 201, { user, token, refreshToken }, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isVerified) {
      return next(new AppError('Please verify your email with OTP before logging in.', 403));
    }

    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    user.password = undefined;
    user.refreshToken = undefined;

    sendResponse(res, 200, { user, token, refreshToken }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(new AppError('Refresh token is required.', 400));
    }

    const jwt = require('jsonwebtoken');
    const config = require('../config');
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return next(new AppError('Invalid refresh token.', 401));
    }

    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    sendResponse(res, 200, { token: newToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (error) {
    next(new AppError('Invalid or expired refresh token.', 401));
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('favorites')
      .populate({
        path: 'savedItems.item',
        select: 'title content type price pricing images category location tags status serviceType author',
      });
    sendResponse(res, 200, user);
  } catch (error) {
    next(error);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'phone', 'bio', 'department', 'year', 'avatar'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file) {
      updateData.avatar = req.file.path;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    sendResponse(res, 200, user, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 400));
    }

    user.password = newPassword;
    await user.save();

    const token = user.generateAuthToken();
    sendResponse(res, 200, { token }, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

exports.toggleFavorite = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const user = await User.findById(req.user._id);

    const index = user.favorites.indexOf(listingId);
    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(listingId);
    }

    await user.save({ validateBeforeSave: false });

    // Also update the listing's favoritedBy
    const Listing = require('../models/Listing');
    const listing = await Listing.findById(listingId);
    if (listing) {
      const listingIndex = listing.favoritedBy.indexOf(req.user._id);
      if (listingIndex > -1) {
        listing.favoritedBy.splice(listingIndex, 1);
      } else {
        listing.favoritedBy.push(req.user._id);
      }
      await listing.save({ validateBeforeSave: false });
    }

    sendResponse(res, 200, { favorites: user.favorites }, 'Favorites updated');
  } catch (error) {
    next(error);
  }
};

exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-favorites -wallet');
    if (!user) return next(new AppError('User not found.', 404));
    sendResponse(res, 200, user);
  } catch (error) {
    next(error);
  }
};
