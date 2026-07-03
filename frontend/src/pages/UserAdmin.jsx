// Admin user management. The system administrator creates role-based
// accounts and disables access without deleting audit-linked users.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Mail,
  Power,
  PowerOff,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { ROLE_LABELS } from '../lib/labels';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  confirm_password: '',
  role: 'depot_manager',
  depot_scope: 'Nairobi Depot',
};

const EMPTY_RESET_FORM = {
  user_id: '',
  password: '',
  confirm_password: '',
};

const PASSWORD_GUIDANCE = 'At least 8 characters with uppercase, lowercase, number, and special character.';

const ROLE_OPTIONS = [
  'national_supplier',
  'depot_manager',
  'cooperative_official',
  'system_administrator',
];

const DEPOT_SCOPED_ROLES = ['depot_manager', 'cooperative_official'];
const DEPOT_SCOPE_OPTIONS = ['Nairobi Depot', 'Nakuru Depot'];

export default function UserAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [userFilter, setUserFilter] = useState('active');

  const loadUsers = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.role === 'system_administrator').length;
    return { total: users.length, active, inactive: users.length - active, admins };
  }, [users]);
  const visibleUsers = useMemo(() => (
    users.filter((u) => {
      if (userFilter === 'inactive') return !u.is_active;
      if (userFilter === 'all') return true;
      return u.is_active;
    })
  ), [userFilter, users]);

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'role' && !DEPOT_SCOPED_ROLES.includes(value)) {
        next.depot_scope = '';
      }
      if (field === 'role' && DEPOT_SCOPED_ROLES.includes(value) && !next.depot_scope) {
        next.depot_scope = DEPOT_SCOPE_OPTIONS[0];
      }
      return next;
    });
  }

  function updateReset(field, value) {
    setResetForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const payload = {
        ...form,
        depot_scope: DEPOT_SCOPED_ROLES.includes(form.role) ? form.depot_scope : null,
      };
      const res = await api.post('/users', payload);
      setResult(`${res.data.user.name} created.`);
      setUserFilter('active');
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetBusy(true);
    setError('');
    setResult('');
    try {
      const res = await api.patch(`/users/${resetForm.user_id}/password`, {
        password: resetForm.password,
        confirm_password: resetForm.confirm_password,
      });
      setResult(res.data.message);
      setResetForm(EMPTY_RESET_FORM);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset user password.');
    } finally {
      setResetBusy(false);
    }
  }

  async function toggleStatus(targetUser) {
    setStatusBusyId(targetUser.id);
    setError('');
    setResult('');
    try {
      const nextStatus = !targetUser.is_active;
      const res = await api.patch(`/users/${targetUser.id}/status`, {
        is_active: nextStatus,
      });
      setResult(res.data.message);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update user status.');
    } finally {
      setStatusBusyId(null);
    }
  }

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">User management</h1>
        <p className="mt-1 text-sm text-mute">
          Create role-based accounts and control access for inactive users.
        </p>
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

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={stats.total} Icon={Users} tone="moss" />
        <StatCard label="Active" value={stats.active} Icon={CheckCircle2} tone="moss" />
        <StatCard label="Inactive" value={stats.inactive} Icon={PowerOff} tone="alert" />
        <StatCard label="Admins" value={stats.admins} Icon={ShieldCheck} tone="clay" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
              <UserPlus size={16} className="text-moss" />
              Create user
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Name">
                <input
                  className="field-input"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                  placeholder="Depot Officer"
                />
              </Field>

              <Field label="Email">
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <input
                    type="email"
                    className="field-input pl-9"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                    placeholder="user@example.com"
                  />
                </div>
              </Field>

              <PasswordInput
                label="Password"
                value={form.password}
                onChange={(value) => update('password', value)}
              />

              <PasswordInput
                label="Confirm password"
                value={form.confirm_password}
                onChange={(value) => update('confirm_password', value)}
              />

              <p className="rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-mute">
                {PASSWORD_GUIDANCE}
              </p>

              <Field label="Role">
                <select
                  className="field-input"
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  required
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>

              {DEPOT_SCOPED_ROLES.includes(form.role) && (
                <Field label="Depot assignment">
                  <select
                    className="field-input"
                    value={form.depot_scope}
                    onChange={(e) => update('depot_scope', e.target.value)}
                    required
                  >
                    {DEPOT_SCOPE_OPTIONS.map((depot) => (
                      <option key={depot} value={depot}>
                        {depot}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
              >
                <UserPlus size={16} />
                {busy ? 'Creating...' : 'Create account'}
              </button>
            </form>
          </section>

          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
              <KeyRound size={16} className="text-moss" />
              Reset password
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <Field label="User">
                <select
                  className="field-input"
                  value={resetForm.user_id}
                  onChange={(e) => updateReset('user_id', e.target.value)}
                  required
                >
                  <option value="">Select user</option>
                  {visibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} - {ROLE_LABELS[u.role] || u.role}
                    </option>
                  ))}
                </select>
              </Field>

              <PasswordInput
                label="New password"
                value={resetForm.password}
                onChange={(value) => updateReset('password', value)}
              />

              <PasswordInput
                label="Confirm new password"
                value={resetForm.confirm_password}
                onChange={(value) => updateReset('confirm_password', value)}
              />

              <button
                type="submit"
                disabled={resetBusy || !users.length}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
              >
                <KeyRound size={16} />
                {resetBusy ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </section>
        </div>

        <section className="card-shadow overflow-hidden rounded-lg border border-line bg-card">
          <div className="border-b border-line px-5 py-4 text-sm font-medium text-ink">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>User directory</span>
              <div className="inline-flex rounded-lg border border-line bg-canvas p-1 text-xs">
                <FilterButton active={userFilter === 'active'} onClick={() => setUserFilter('active')}>
                  Active
                </FilterButton>
                <FilterButton active={userFilter === 'inactive'} onClick={() => setUserFilter('inactive')}>
                  Inactive
                </FilterButton>
                <FilterButton active={userFilter === 'all'} onClick={() => setUserFilter('all')}>
                  All
                </FilterButton>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-mute">Loading users...</p>
          ) : visibleUsers.length === 0 ? (
            <p className="p-5 text-sm text-mute">
              No {userFilter === 'all' ? '' : userFilter} users to show.
            </p>
          ) : (
            <div className="table-shell rounded-none border-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-mute">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Depot</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="break-words font-medium text-ink">{u.name}</div>
                      <div className="break-all text-xs text-mute">{u.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-mute">
                      {ROLE_LABELS[u.role] || u.role}
                    </td>
                    <td className="px-5 py-3.5 text-mute">
                      {u.depot_scope || '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          u.is_active
                            ? 'bg-leaf-soft text-moss'
                            : 'bg-alert-soft text-alert'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-mute">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleStatus(u)}
                        disabled={statusBusyId === u.id || Number(u.id) === Number(user?.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          u.is_active
                            ? 'border-alert-soft text-alert hover:bg-alert-soft'
                            : 'border-line text-moss hover:bg-leaf-soft'
                        }`}
                      >
                        {u.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
        active ? 'bg-card text-ink shadow-sm' : 'text-mute hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function PasswordInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="relative">
        <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="password"
          minLength="8"
          className="field-input pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder="Strong password"
        />
      </div>
    </Field>
  );
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
