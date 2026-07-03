import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  HandCoins,
  MapPin,
  PackageCheck,
  Scale,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { ROLE_LABELS } from '../lib/labels';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  stock_id: '',
  quantity: '',
  recipient_name: '',
  recipient_identifier: '',
  location: '',
  notes: '',
};

export default function Distribution() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [stockRes, distributionRes] = await Promise.all([
        api.get('/stock'),
        api.get('/distributions'),
      ]);
      setStock(stockRes.data.stock || []);
      setDistributions(distributionRes.data.distributions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load distribution data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const issuableStock = useMemo(() => (
    stock.filter((s) => (
      Number(s.held_quantity || 0) > 0
      && !['expired', 'recalled'].includes(s.status)
    ))
  ), [stock]);

  const selectedStock = useMemo(() => (
    issuableStock.find((s) => Number(s.id) === Number(form.stock_id))
  ), [issuableStock, form.stock_id]);

  const stats = useMemo(() => {
    const availableBags = issuableStock.reduce((sum, s) => sum + Number(s.held_quantity || 0), 0);
    const issuedBags = distributions.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
    const recipients = new Set(distributions.map((d) => d.recipient_name)).size;
    return { availableBags, issuedBags, recipients, records: distributions.length };
  }, [issuableStock, distributions]);

  const selectedHeld = Number(selectedStock?.held_quantity || 0);
  const selectedTotal = Number(selectedStock?.quantity || 0);
  const selectedPct = selectedTotal > 0
    ? Math.min(100, Math.round((selectedHeld / selectedTotal) * 100))
    : 0;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const res = await api.post('/distributions', {
        stock_id: Number(form.stock_id),
        quantity: Number(form.quantity),
        recipient_name: form.recipient_name,
        recipient_identifier: form.recipient_identifier,
        location: form.location,
        notes: form.notes,
      });
      setResult(`${res.data.quantity} bag(s) issued to ${res.data.recipient_name}.`);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not issue this stock.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="console-panel mb-6 rounded-lg border border-line p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-mute">
              <ShieldCheck size={14} className="text-moss" />
              Cooperative final-mile issue
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
              Issue fertiliser to groups and farmers
            </h1>
            <p className="mt-2 text-sm leading-6 text-mute">
              Reduce cooperative stock, keep recipient evidence, and write the issue into the custody audit.
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Available bags" value={stats.availableBags.toLocaleString()} Icon={PackageCheck} tone="moss" />
        <StatCard label="Issued bags" value={stats.issuedBags.toLocaleString()} Icon={HandCoins} tone="clay" />
        <StatCard label="Recipients" value={stats.recipients} Icon={UserRound} tone="moss" />
        <StatCard label="Issue records" value={stats.records} Icon={ClipboardList} tone="wheat" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[430px_1fr]">
        <section className="card-shadow rounded-lg border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">Record issue</div>
              <div className="mt-0.5 text-xs text-mute">Cooperative stock is deducted on submit</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf-soft text-moss">
              <HandCoins size={18} />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-mute">Loading stock...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Batch">
                <select
                  className="field-input"
                  value={form.stock_id}
                  onChange={(e) => update('stock_id', e.target.value)}
                  required
                >
                  <option value="">Select batch</option>
                  {issuableStock.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.batch_number} - {s.held_quantity} available
                    </option>
                  ))}
                </select>
              </Field>

              {selectedStock && (
                <div className="rounded-lg border border-line bg-canvas px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-ink">{selectedStock.batch_number}</div>
                      <div className="mt-1 text-xs text-mute">{selectedStock.fertiliser_type}</div>
                    </div>
                    <StatusBadge status={selectedStock.status} />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-moss"
                      style={{ width: `${selectedPct}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MiniMetric label="Held" value={`${selectedHeld}`} />
                    <MiniMetric label="Issued" value={`${selectedStock.issued_quantity || 0}`} />
                    <MiniMetric label="Total" value={`${selectedTotal}`} />
                  </div>
                </div>
              )}

              <Field label="Bags to issue">
                <input
                  type="number"
                  min="1"
                  max={selectedStock?.held_quantity || undefined}
                  className="field-input tabular-nums"
                  value={form.quantity}
                  onChange={(e) => update('quantity', e.target.value)}
                  required
                  placeholder="0"
                />
              </Field>

              <Field label="Recipient / group">
                <input
                  className="field-input"
                  value={form.recipient_name}
                  onChange={(e) => update('recipient_name', e.target.value)}
                  required
                  placeholder="Kiambu Farmers Group"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reference">
                  <input
                    className="field-input"
                    value={form.recipient_identifier}
                    onChange={(e) => update('recipient_identifier', e.target.value)}
                    placeholder="Voucher / group ID"
                  />
                </Field>
                <Field label="Location">
                  <input
                    className="field-input"
                    value={form.location}
                    onChange={(e) => update('location', e.target.value)}
                    placeholder="Cooperative store"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  className="field-input min-h-24 resize-y"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="Optional issue remarks"
                />
              </Field>

              {issuableStock.length === 0 && (
                <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-mute">
                  No issuable stock is currently held by this cooperative.
                </div>
              )}

              <button
                type="submit"
                disabled={busy || issuableStock.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-moss px-5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
              >
                <HandCoins size={16} />
                {busy ? 'Issuing...' : 'Record issue'}
              </button>
            </form>
          )}
        </section>

        <section className="card-shadow rounded-lg border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">Recent issue records</div>
              <div className="mt-0.5 text-xs text-mute">Latest cooperative distributions and recipients</div>
            </div>
            <ClipboardList size={18} className="text-moss" />
          </div>
          {loading ? (
            <p className="text-sm text-mute">Loading records...</p>
          ) : distributions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-10 text-center">
              <HandCoins size={26} className="mx-auto text-moss/70" />
              <p className="mt-2 text-sm font-medium text-ink">No issue records yet</p>
              <p className="mt-1 text-xs text-mute">
                Issued stock will appear here and in the custody audit.
              </p>
            </div>
          ) : (
            <div className="table-shell">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-mute">
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Bags</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {distributions.map((record) => (
                    <tr key={record.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-ink">{record.batch_number}</div>
                        <div className="mt-0.5 text-xs text-mute">{record.fertiliser_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-ink">{record.recipient_name}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-mute">
                          <MapPin size={12} />
                          {record.location || 'Location not recorded'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-sm font-medium text-ink">
                          <Scale size={13} className="text-mute" />
                          {record.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-mute">
                        {formatDate(record.issued_at)}
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

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-md bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-mute">{label}</div>
      <div className="font-mono text-sm font-medium text-ink">{value}</div>
    </div>
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
