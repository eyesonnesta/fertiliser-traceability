// Alerts & recall page. Shows batches that are expired or near expiry,
// and lets an authorised user record a recall with an audit reason.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  RefreshCcw,
} from 'lucide-react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/labels';

const EMPTY_FORM = { stock_id: '', reason: '' };
const RECALL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];
const RECALL_STATUS_LABELS = RECALL_STATUS_OPTIONS.reduce((acc, option) => ({
  ...acc,
  [option.value]: option.label,
}), {});

export default function Recall() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [alerts, setAlerts] = useState({ expired: [], expiring_soon: [], window_days: 30 });
  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [statusForms, setStatusForms] = useState({});
  const [result, setResult] = useState('');

  const loadRecallData = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [stockRes, alertsRes, recallsRes] = await Promise.all([
        api.get('/stock'),
        api.get('/recall/expiring'),
        api.get('/recall'),
      ]);
      setStock(stockRes.data.stock || []);
      setAlerts(alertsRes.data);
      setRecalls(recallsRes.data.recalls || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load recall data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRecallData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecallData]);

  const recallableStock = useMemo(() => (
    stock.filter((s) => s.status !== 'recalled')
  ), [stock]);

  const selectedStock = useMemo(() => (
    stock.find((s) => Number(s.id) === Number(form.stock_id))
  ), [stock, form.stock_id]);

  const canUpdateRecallStatus = ['system_administrator', 'cooperative_official'].includes(user?.role);

  function getStatusForm(recall) {
    return statusForms[recall.id] || {
      status: recall.recall_status || 'pending',
      notes: '',
    };
  }

  function updateStatusForm(recallId, patch) {
    setStatusForms((current) => ({
      ...current,
      [recallId]: {
        status: current[recallId]?.status || 'pending',
        notes: current[recallId]?.notes || '',
        ...patch,
      },
    }));
  }

  async function runExpiryCheck() {
    setCheckBusy(true);
    setError('');
    setResult('');
    try {
      const res = await api.post('/recall/check-expiry');
      setResult(`Expiry check completed. ${res.data.updated_count} batch(es) newly flagged.`);
      await loadRecallData();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not run the expiry check.');
    } finally {
      setCheckBusy(false);
    }
  }

  async function handleRecall(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const res = await api.post('/recall', {
        stock_id: Number(form.stock_id),
        reason: form.reason.trim(),
      });
      setResult(`${res.data.batch_number} recalled and recorded in custody history.`);
      setForm(EMPTY_FORM);
      await loadRecallData();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not recall this batch.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusUpdate(e, recall) {
    e.preventDefault();
    const statusForm = getStatusForm(recall);
    setStatusBusyId(recall.id);
    setError('');
    setResult('');
    try {
      const res = await api.patch(`/recall/${recall.id}/status`, {
        status: statusForm.status,
        notes: statusForm.notes.trim(),
      });
      setResult(`${recall.batch_number} recall status updated to ${RECALL_STATUS_LABELS[res.data.recall.recall_status] || res.data.recall.recall_status}.`);
      setStatusForms((current) => ({
        ...current,
        [recall.id]: {
          status: res.data.recall.recall_status,
          notes: '',
        },
      }));
      await loadRecallData();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update recall status.');
    } finally {
      setStatusBusyId(null);
    }
  }

  const totalAlerts = alerts.expired.length + alerts.expiring_soon.length;

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Alerts & recall</h1>
          <p className="mt-1 text-sm text-mute">
            Detect expired stock and record recall actions with custody evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={runExpiryCheck}
          disabled={checkBusy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50 sm:w-auto"
        >
          <RefreshCcw size={16} />
          {checkBusy ? 'Checking...' : 'Run expiry check'}
        </button>
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
        <StatCard label="Active alerts" value={totalAlerts} Icon={AlertTriangle} tone="wheat" />
        <StatCard label="Expired" value={alerts.expired.length} Icon={Ban} tone="alert" />
        <StatCard
          label="Expiring soon"
          value={alerts.expiring_soon.length}
          Icon={CalendarClock}
          tone="clay"
          hint={`${alerts.window_days || 30} day window`}
        />
        <StatCard label="Recalls" value={recalls.length} Icon={ClipboardList} tone="moss" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card-shadow min-w-0 rounded-lg border border-line bg-card p-6">
          <div className="mb-4 text-sm font-medium text-ink">Expiry alerts</div>

          {loading ? (
            <p className="text-sm text-mute">Loading alerts...</p>
          ) : totalAlerts === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center">
              <CheckCircle2 size={24} className="mx-auto text-moss" />
              <p className="mt-2 text-sm font-medium text-ink">No expiry alerts</p>
              <p className="mt-1 text-xs text-mute">
                Batches due within {alerts.window_days || 30} days will appear here.
              </p>
            </div>
          ) : (
            <div className="table-shell">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-mute">
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                    <th className="px-4 py-3 font-medium">Holder</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...alerts.expired, ...alerts.expiring_soon].map((s) => (
                    <tr key={s.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="break-all font-mono text-xs text-ink">{s.batch_number}</div>
                        <div className="mt-0.5 text-xs text-mute">{s.fertiliser_type}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-mute">
                        {formatDate(s.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-mute">
                        <div className="break-words text-sm text-ink">{s.holder_name || 'Unassigned'}</div>
                        <div className="text-xs">{ROLE_LABELS[s.holder_role] || s.holder_role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/stock/${s.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-moss hover:text-forest"
                        >
                          View <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-5">
          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
              <Ban size={16} className="text-alert" />
              Record recall
            </div>

            <form onSubmit={handleRecall} className="space-y-4">
              <Field label="Batch">
                <select
                  className="field-input"
                  value={form.stock_id}
                  onChange={(e) => setForm((f) => ({ ...f, stock_id: e.target.value }))}
                  required
                >
                  <option value="">Select batch</option>
                  {recallableStock.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.batch_number} - {s.status}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedStock && (
                <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-ink">{selectedStock.batch_number}</div>
                      <div className="mt-0.5 text-xs text-mute">
                        Expires {formatDate(selectedStock.expiry_date)}
                      </div>
                    </div>
                    <StatusBadge status={selectedStock.status} />
                  </div>
                </div>
              )}

              <Field label="Reason">
                <textarea
                  className="field-input min-h-28 resize-y"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  required
                  placeholder="Damaged packaging, expired stock, contamination concern..."
                />
              </Field>

              <button
                type="submit"
                disabled={busy || recallableStock.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-alert px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alert/90 disabled:opacity-50"
              >
                <Ban size={16} />
                {busy ? 'Recording...' : 'Record recall'}
              </button>
            </form>
          </section>

          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 text-sm font-medium text-ink">Recent recall records</div>
            {loading ? (
              <p className="text-sm text-mute">Loading records...</p>
            ) : recalls.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-mute">
                No recalls recorded yet.
              </p>
            ) : (
              <ol className="space-y-4">
                {recalls.slice(0, 6).map((r) => {
                  const statusForm = getStatusForm(r);
                  return (
                    <li key={r.id} className="border-b border-line/70 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="break-all font-mono text-xs text-ink">{r.batch_number}</div>
                            <RecallStatusPill status={r.recall_status || 'pending'} />
                          </div>
                          <div className="mt-1 text-xs text-mute">
                            {r.flagged_by_name} - {ROLE_LABELS[r.flagged_by_role] || r.flagged_by_role}
                          </div>
                        </div>
                        <div className="text-right text-xs tabular-nums text-mute">
                          {formatDate(r.flagged_at)}
                        </div>
                      </div>
                      <p className="mt-2 break-words text-xs text-mute">{r.reason}</p>
                      {r.status_notes && (
                        <div className="mt-2 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-mute">
                          <span className="font-medium text-ink">Latest note:</span> {r.status_notes}
                          {r.status_updated_by_name && (
                            <span> - {r.status_updated_by_name}</span>
                          )}
                        </div>
                      )}

                      {canUpdateRecallStatus && (
                        <form
                          onSubmit={(e) => handleStatusUpdate(e, r)}
                          className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3"
                        >
                          <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
                            <select
                              className="field-input"
                              value={statusForm.status}
                              onChange={(e) => updateStatusForm(r.id, { status: e.target.value })}
                              disabled={statusBusyId === r.id}
                            >
                              {RECALL_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input
                              className="field-input"
                              value={statusForm.notes}
                              onChange={(e) => updateStatusForm(r.id, { notes: e.target.value })}
                              maxLength={255}
                              required
                              placeholder="Add status update notes"
                              disabled={statusBusyId === r.id}
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={statusBusyId === r.id || !statusForm.notes.trim()}
                            className="inline-flex items-center gap-2 rounded-lg bg-moss px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            {statusBusyId === r.id ? 'Updating...' : 'Update status'}
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
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

function RecallStatusPill({ status }) {
  const classes = {
    pending: 'border-wheat/40 bg-wheat-soft text-clay',
    in_review: 'border-moss/20 bg-leaf-soft text-moss',
    resolved: 'border-moss/25 bg-moss/10 text-moss',
    rejected: 'border-alert/20 bg-alert-soft text-alert',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes[status] || 'border-line bg-canvas text-mute'}`}>
      {RECALL_STATUS_LABELS[status] || status}
    </span>
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
