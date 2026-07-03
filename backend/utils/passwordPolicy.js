const PASSWORD_REQUIREMENTS = [
  '8 to 128 characters',
  'one uppercase letter',
  'one lowercase letter',
  'one number',
  'one special character',
];

const PASSWORD_GUIDANCE = `Password must include ${PASSWORD_REQUIREMENTS.join(', ')}.`;

function validatePasswordPolicy(password) {
  const value = String(password || '');
  const checks = [
    value.length >= 8 && value.length <= 128,
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];

  if (checks.every(Boolean)) {
    return null;
  }

  return PASSWORD_GUIDANCE;
}

module.exports = {
  PASSWORD_GUIDANCE,
  PASSWORD_REQUIREMENTS,
  validatePasswordPolicy,
};
