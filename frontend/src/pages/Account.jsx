import { useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/labels';

const EMPTY_FORM = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

const PASSWORD_GUIDANCE = 'At least 8 characters with uppercase, lowercase, number, and special character.';

export default function Account() {
  const { user, applyAuthUpdate } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const res = await api.patch('/auth/password', form);
      applyAuthUpdate({
        user: res.data.user,
        token: res.data.token,
      });
      setResult(res.data.message);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="console-panel mb-6 rounded-lg border border-line p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-mute">
              <ShieldCheck size={14} className="text-moss" />
              Account security
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
              Manage your sign-in password
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
              Password updates require your current password and are checked against the system security policy.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs text-mute">
            <UserRound size={14} />
            {ROLE_LABELS[user?.role] || user?.role}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-alert-soft px-4 py-3 text-sm text-alert">
          {error}
        </div>
      )}
      {result && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-leaf-soft px-4 py-3 text-sm text-moss">
          <CheckCircle2 size={16} />
          {result}
        </div>
      )}
      {user?.must_change_password && (
        <div className="mb-4 rounded-lg border border-wheat bg-wheat-soft px-4 py-3 text-sm text-ink">
          This is your first sign-in with an administrator-issued password. Update it before continuing normal operations.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <section className="card-shadow rounded-lg border border-line bg-card p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
            <KeyRound size={16} className="text-moss" />
            Change password
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Current password"
              value={form.current_password}
              onChange={(value) => update('current_password', value)}
            />
            <PasswordField
              label="New password"
              value={form.new_password}
              onChange={(value) => update('new_password', value)}
            />
            <PasswordField
              label="Confirm new password"
              value={form.confirm_password}
              onChange={(value) => update('confirm_password', value)}
            />

            <p className="rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-mute">
              {PASSWORD_GUIDANCE}
            </p>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-moss px-5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
            >
              <LockKeyhole size={16} />
              {busy ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </section>

        <section className="card-shadow rounded-lg border border-line bg-card p-6">
          <div className="text-sm font-medium text-ink">Current account</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AccountFact label="Name" value={user?.name} />
            <AccountFact label="Email" value={user?.email} />
            <AccountFact label="Role" value={ROLE_LABELS[user?.role] || user?.role} />
          </div>
        </section>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <div className="relative">
        <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="password"
          minLength="8"
          className="field-input pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
    </label>
  );
}

function AccountFact({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-4 py-3">
      <div className="text-xs text-mute">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value || '-'}</div>
    </div>
  );
}
