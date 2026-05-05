const nodemailer = require('nodemailer');
const config = require('../config');

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  if (!config.email.host || !config.email.user || !config.email.pass) {
    throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  return cachedTransporter;
};

const sendOtpEmail = async ({ to, firstName, otp }) => {
  const transporter = getTransporter();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.4; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Commune-X Email Verification</h2>
      <p>Hello ${firstName || 'User'},</p>
      <p>Your verification code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 3px; margin: 16px 0;">${otp}</div>
      <p>This code expires in 60 seconds.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to,
    subject: 'Commune-X OTP Verification Code',
    text: `Your Commune-X verification code is ${otp}. It expires in 60 seconds.`,
    html,
  });
};

const sendWelcomeEmail = async (to, firstName) => {
  const transporter = getTransporter();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2>Hello ${firstName || 'User'},</h2>
      <p>Welcome to Commune-X</p>
      <p>Your account has been successfully created.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject: 'Welcome to CommuneX',
      text: `Hello ${firstName || 'User'}, Welcome to Commune-X.`,
      html,
    });
  } catch (error) {
    console.error('sendWelcomeEmail SMTP error:', error.message);
    throw error;
  }
};

const sendRecommendationEmail = async ({ to, firstName, items = [] }) => {
  const transporter = getTransporter();
  const listHtml = items.length
    ? items.map((item) => `<li><strong>${item.title}</strong> - ${item.price === 0 ? 'Free' : `INR ${item.price}`}</li>`).join('')
    : '<li>Fresh marketplace picks are waiting for you.</li>';

  await transporter.sendMail({
    from: config.email.from,
    to,
    subject: 'Recommended for you on CommuneX',
    text: `Hello ${firstName || 'User'}, we found CommuneX items you may like: ${items.map((item) => item.title).join(', ') || 'new marketplace picks'}.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2>Hello ${firstName || 'User'},</h2>
        <p>Based on your searches, saved items, and viewed categories, here are a few picks for you:</p>
        <ul>${listHtml}</ul>
        <p>Open CommuneX to view more recommendations.</p>
      </div>
    `,
  });
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendRecommendationEmail,
};
