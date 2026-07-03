import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, Leaf } from 'lucide-react';
import api from '../api/client';

const PASSWORD_REQUIREMENTS = [
  { label: '8 to 128 characters', test: (value) => value.length >= 8 && value.length <= 128 },
  { label: 'one uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'one lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'one number', test: (value) => /\d/.test(value) },
  { label: 'one special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

function validatePassword(password) {
  return PASSWORD_REQUIREMENTS.every((rule) => rule.test(password));
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordStatus = useMemo(() => (
    PASSWORD_REQUIREMENTS.map((rule) => ({
      label: rule.label,
      met: rule.test(newPassword),
    }))
  ), [newPassword]);
  const passwordsMatch = !confirmPassword || newPassword === confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!token.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (!validatePassword(newPassword)) {
      setError('Password does not meet the required rules.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/auth/reset-password', {
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage(res.data.message || 'Password reset successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthRecoveryShell
      title="Create a new password"
      subtitle="Use the reset link from your email to set a new password."
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Reset token</span>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            rows={3}
            className="field-input resize-none font-mono text-xs"
            placeholder="Token from reset link"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="field-input"
          />
        </label>

        <div className="rounded-lg border border-line bg-canvas px-3 py-3 text-xs text-mute">
          <div className="mb-2 font-medium text-ink">Password rules</div>
          <div className="grid gap-1">
            {passwordStatus.map((rule) => (
              <div key={rule.label} className={rule.met ? 'text-moss' : 'text-mute'}>
                {rule.met ? 'OK' : '-'} {rule.label}
              </div>
            ))}
            {!passwordsMatch && (
              <div className="text-alert">- passwords must match</div>
            )}
          </div>
        </div>

        {message && (
          <div className="rounded-lg bg-leaf-soft px-3 py-2 text-sm text-moss">
            {message}
            <Link
              to="/login"
              className="mt-2 inline-flex items-center gap-1 font-medium text-moss hover:text-forest"
            >
              Go to sign in <ArrowRight size={13} />
            </Link>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy || Boolean(message)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-moss py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
        >
          {busy ? 'Resetting...' : <>Reset password <ArrowRight size={16} /></>}
        </button>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-moss hover:text-forest"
        >
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
      </form>
    </AuthRecoveryShell>
  );
}

function AuthRecoveryShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="card-shadow w-full max-w-md rounded-lg border border-line bg-card p-6 sm:p-7">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-leaf shadow-sm">
            <Leaf size={20} className="text-forest" strokeWidth={2.5} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-wheat" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold text-ink">Mfuatano</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-mute">
              account recovery
            </div>
          </div>
        </div>

        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-leaf-soft text-moss">
          <KeyRound size={21} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-mute">{subtitle}</p>

        {children}
      </div>
    </div>
  );
}
