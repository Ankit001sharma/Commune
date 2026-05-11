const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'communex',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    currency: process.env.RAZORPAY_CURRENCY || 'INR',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    apiKeys: (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean),
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  /* Redis + BullMQ — optional; AI email agent queues no-op when REDIS_URL unset */
  redis: {
    url: process.env.REDIS_URL || '',
  },

  recommendation: {
    dailyDigestCron: process.env.REC_DAILY_CRON || '0 9 * * *',
    reEngagementCron: process.env.REC_REENGAGEMENT_CRON || '0 10 * * 1',
    inactiveDaysForReEngagement: parseInt(process.env.REC_INACTIVE_DAYS || '7', 10),
    reEngagementCooldownDays: parseInt(process.env.REC_REENGAGEMENT_COOLDOWN_DAYS || '14', 10),
  },
};
