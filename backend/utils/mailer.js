const nodemailer = require('nodemailer');

const RESET_LINK_TTL_MINUTES = 30;

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
      && process.env.SMTP_PORT
      && process.env.SMTP_USER
      && process.env.SMTP_PASS
      && process.env.SMTP_FROM
  );
}

function frontendBaseUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function buildPasswordResetLink(rawToken) {
  const params = new URLSearchParams({ token: rawToken });
  return `${frontendBaseUrl()}/reset-password?${params.toString()}`;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendPasswordResetEmail({ to, resetLink }) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[mail] SMTP is not configured. Password reset email was not sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and FRONTEND_URL.'
      );
    }
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = createTransporter();
  const safeResetLink = escapeHtml(resetLink);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Password Reset Request',
    text: [
      'A password reset was requested for your Fertiliser Traceability System account.',
      '',
      `Reset your password using this link: ${resetLink}`,
      '',
      `This link expires in ${RESET_LINK_TTL_MINUTES} minutes.`,
      'If you did not request this password reset, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>A password reset was requested for your Fertiliser Traceability System account.</p>
      <p><a href="${safeResetLink}">Reset your password</a></p>
      <p>This link expires in ${RESET_LINK_TTL_MINUTES} minutes.</p>
      <p>If you did not request this password reset, you can ignore this email.</p>
    `,
  });

  return { sent: true };
}

module.exports = {
  buildPasswordResetLink,
  sendPasswordResetEmail,
};
