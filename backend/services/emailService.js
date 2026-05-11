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

/* ------------------------------------------------------------------ */
/* Existing transactional emails (unchanged)                            */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* LEGACY: kept so old recommendationAgent stub doesn't break imports.  */
/* ------------------------------------------------------------------ */
const sendRecommendationEmail = async ({ to, firstName, items = [] }) => {
  return sendPersonalizedDigestEmail({
    to,
    firstName,
    items,
    composed: {
      subject: 'Recommended for you on CommuneX',
      preheader: 'Hand-picked items just for you.',
      intro: `Hello ${firstName || 'User'}, here are a few CommuneX items you may like.`,
      ctaLabel: 'Open CommuneX',
      reasons: items.map(() => 'Picked from new marketplace listings'),
    },
  });
};

/* ------------------------------------------------------------------ */
/* New: AI-generated digest & alerts                                   */
/* ------------------------------------------------------------------ */

/**
 * Render a single item card. Inline styles only (most clients strip <style>).
 */
const renderItemCard = ({ item, reason, baseUrl, campaignId }) => {
  const img = item.images?.[0]?.url || `${baseUrl}/uploads/placeholder.png`;
  const price = item.price === 0 ? 'Free' : `₹${item.price}`;
  const link = `${baseUrl}/marketplace/${item._id}?utm_source=email&utm_campaign=${campaignId || 'rec'}`;
  const safeTitle = String(item.title || '').replace(/</g, '&lt;');
  const safeReason = String(reason || '').replace(/</g, '&lt;');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 12px 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <tr>
        <td width="120" valign="top" style="padding: 12px;">
          <a href="${link}" style="text-decoration: none;">
            <img src="${img}" alt="${safeTitle}" width="100" height="100"
                 style="display: block; border-radius: 8px; object-fit: cover; width: 100px; height: 100px;" />
          </a>
        </td>
        <td valign="top" style="padding: 12px 16px 12px 0;">
          <a href="${link}" style="text-decoration: none; color: #111827;">
            <div style="font-size: 16px; font-weight: 600; margin: 0 0 4px;">${safeTitle}</div>
          </a>
          <div style="font-size: 14px; color: #6366f1; font-weight: 600; margin: 0 0 6px;">${price}</div>
          <div style="font-size: 13px; color: #6b7280; line-height: 1.4;">${safeReason}</div>
        </td>
      </tr>
    </table>
  `;
};

/**
 * Build the full HTML email shell — header, intro, item cards, CTA, footer.
 */
const renderDigestHtml = ({ firstName, composed, items, baseUrl, campaignId, unsubscribeUrl }) => {
  const cards = items
    .map((item, i) => renderItemCard({ item, reason: composed.reasons[i] || '', baseUrl, campaignId }))
    .join('');
  const ctaLink = `${baseUrl}/?utm_source=email&utm_campaign=${campaignId || 'rec'}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${composed.subject || 'Recommended for you'}</title>
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <!-- Preheader (hidden in email body, visible in inbox preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; visibility: hidden;">
    ${composed.preheader || ''}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 16px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff;">
              <div style="font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85;">CommuneX</div>
              <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">Hi ${firstName || 'there'},</div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 24px 32px 8px; font-size: 15px; color: #374151; line-height: 1.6;">
              ${composed.intro || ''}
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 8px 24px;">
              ${cards}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 16px 32px 32px;">
              <a href="${ctaLink}"
                 style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none;
                        padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 15px;">
                ${composed.ctaLabel || 'See your picks'}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 24px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6;">
              You're receiving this because you opted in to recommendations on CommuneX.<br/>
              <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Plain-text fallback (some clients still prefer it; deliverability boost).
 */
const renderDigestText = ({ firstName, composed, items, baseUrl }) => {
  const lines = [];
  lines.push(`Hi ${firstName || 'there'},`);
  lines.push('');
  lines.push(composed.intro || '');
  lines.push('');
  items.forEach((item, i) => {
    const price = item.price === 0 ? 'Free' : `₹${item.price}`;
    lines.push(`• ${item.title} — ${price}`);
    if (composed.reasons[i]) lines.push(`  ${composed.reasons[i]}`);
    lines.push(`  ${baseUrl}/marketplace/${item._id}`);
    lines.push('');
  });
  lines.push(`Open CommuneX: ${baseUrl}`);
  return lines.join('\n');
};

/**
 * sendPersonalizedDigestEmail — daily digest (3-5 items)
 */
const sendPersonalizedDigestEmail = async ({ to, firstName, items, composed, campaignId, baseUrl }) => {
  if (!items?.length) return null;
  const transporter = getTransporter();
  const resolvedBaseUrl = baseUrl || config.corsOrigin || 'http://localhost:3000';
  const unsubscribeUrl = `${resolvedBaseUrl}/settings/email-preferences`;

  const html = renderDigestHtml({ firstName, composed, items, baseUrl: resolvedBaseUrl, campaignId, unsubscribeUrl });
  const text = renderDigestText({ firstName, composed, items, baseUrl: resolvedBaseUrl });

  const info = await transporter.sendMail({
    from: config.email.from,
    to,
    subject: composed.subject || 'Recommended for you on CommuneX',
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'X-CommuneX-Campaign': campaignId ? String(campaignId) : 'daily-digest',
    },
  });
  return info;
};

/**
 * sendNewMatchEmail — single-listing alert ("a listing just went live for you")
 */
const sendNewMatchEmail = async ({ to, firstName, listing, composed, campaignId, baseUrl }) => {
  return sendPersonalizedDigestEmail({
    to,
    firstName,
    items: [listing],
    composed,
    campaignId,
    baseUrl,
  });
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendRecommendationEmail,           // kept for backward compatibility
  sendPersonalizedDigestEmail,
  sendNewMatchEmail,
};
