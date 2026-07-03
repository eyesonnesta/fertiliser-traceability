import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, Leaf } from 'lucide-react';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: trimmedEmail });
      setMessage(res.data.message || 'If that email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not request a password reset.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthRecoveryShell
      title="Reset your password"
      subtitle="Enter your programme email. If the account exists, a reset link will be issued."
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@programme.go.ke"
            className="field-input"
          />
        </label>

        {message && (
          <div className="rounded-lg bg-leaf-soft px-3 py-2 text-sm text-moss">{message}</div>
        )}
        {error && (
          <div className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-moss py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
        >
          {busy ? 'Sending...' : <>Send reset link <ArrowRight size={16} /></>}
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
