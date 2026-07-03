import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Filter,
  PackageCheck,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { ROLE_LABELS, STATUS_META } from '../lib/labels';

const ACTION_LABELS = {
  registered: 'Registered',
  dispatched: 'Dispatched',
  received: 'Received',
  expired: 'Expired',
  recalled: 'Recalled',
  issued: 'Issued',
};

const BAR_COLORS = ['#2f6b45', '#c2683f', '#3d9963', '#d9a441', '#b23b3b'];

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    action: '',
  });
  const [loading, setLoading] = useState(true);
  const [busyExport, setBusyExport] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const next = {};
    if (filters.from) next.from = filters.from;
    if (filters.to) next.to = filters.to;
    if (filters.action) next.action = filters.action;
    return next;
  }, [filters]);

  const loadReports = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [summaryRes, custodyRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/custody', { params }),
      ]);
      setSummary(summaryRes.data);
      setEvents(custodyRes.data.events || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const actionChartData = useMemo(() => (
    (summary?.actions || []).map((item) => ({
      name: ACTION_LABELS[item.action] || item.action,
      count: Number(item.count || 0),
    }))
  ), [summary]);

  const typeChartData = useMemo(() => (
    (summary?.fertiliser_types || []).map((item) => ({
      name: item.fertiliser_type,
      bags: Number(item.bags || 0),
    }))
  ), [summary]);

  async function exportCsv() {
    setBusyExport(true);
    setError('');
    try {
      const res = await api.get('/reports/custody.csv', {
        params,
        responseType: 'blob',
      });
      const href = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'custody-report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not export custody report.');
    } finally {
      setBusyExport(false);
    }
  }

  const stock = summary?.stock || {};
  const transfers = summary?.transfers || {};
  const distributions = summary?.distributions || {};

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
          <p className="mt-1 text-sm text-mute">
            Custody evidence, movement totals, and stock status summaries.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={busyExport || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50 sm:w-auto"
        >
          <Download size={16} />
          {busyExport ? 'Exporting...' : 'Export CSV'}
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-alert-soft px-4 py-3 text-sm text-alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Batches"
          value={number(stock.total_batches)}
          Icon={PackageCheck}
          tone="moss"
        />
        <StatCard
          label="Bags moved"
          value={number(transfers.moved_bags)}
          Icon={Truck}
          tone="clay"
        />
        <StatCard
          label="Issued bags"
          value={number(distributions.issued_bags)}
          Icon={FileSpreadsheet}
          tone="wheat"
        />
        <StatCard
          label="Audit events"
          value={number(actionChartData.reduce((sum, item) => sum + item.count, 0))}
          Icon={ClipboardList}
          tone="moss"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card-shadow min-w-0 rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
            <BarChart3 size={17} className="text-moss" />
            Custody actions
          </div>
          <ChartFrame empty={!actionChartData.length} emptyText="No custody actions recorded.">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={actionChartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7a70' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={shortLabel}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7a70' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f4f5f1' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3e6e0', fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {actionChartData.map((_, index) => (
                    <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section className="card-shadow min-w-0 rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
            <FileSpreadsheet size={17} className="text-moss" />
            Bags by fertiliser
          </div>
          <ChartFrame empty={!typeChartData.length} emptyText="No fertiliser stock recorded.">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={typeChartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={112}
                  tick={{ fontSize: 11, fill: '#6b7a70' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={shortLabel}
                />
                <Tooltip cursor={{ fill: '#f4f5f1' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3e6e0', fontSize: 12 }} />
                <Bar dataKey="bags" radius={[0, 6, 6, 0]} fill="#2f6b45" />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>
      </div>

      <section className="card-shadow mt-4 min-w-0 rounded-lg border border-line bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
            <Filter size={17} className="text-moss" />
            Custody audit
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[150px_150px_170px_auto]">
            <Field label="From">
              <input
                type="date"
                className="field-input"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                className="field-input"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </Field>
            <Field label="Action">
              <select
                className="field-input"
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={loadReports}
              disabled={loading}
              className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50 sm:self-end"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center text-sm text-mute">
            Loading reports...
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center text-sm text-mute">
            No custody events match these filters.
          </p>
        ) : (
          <div className="table-shell">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-mute">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-xs tabular-nums text-mute">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/stock/${event.stock_id}`}
                        className="break-all font-mono text-xs font-medium text-moss hover:text-forest"
                      >
                        {event.batch_number}
                      </Link>
                      <div className="mt-0.5 text-xs text-mute">{event.fertiliser_type}</div>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {ACTION_LABELS[event.action] || event.action}
                    </td>
                    <td className="px-4 py-3">
                      <div className="break-words text-ink">{event.user_name}</div>
                      <div className="mt-0.5 text-xs text-mute">
                        {ROLE_LABELS[event.user_role] || event.user_role}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="max-w-xs break-words px-4 py-3 text-mute">
                      {event.notes || STATUS_META[event.status]?.label || event.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ChartFrame({ empty, emptyText, children }) {
  if (empty) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-line bg-canvas text-sm text-mute">
        {emptyText}
      </div>
    );
  }
  return <div className="h-56">{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      {children}
    </label>
  );
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortLabel(value) {
  const text = String(value || '');
  return text.length > 12 ? `${text.slice(0, 11)}...` : text;
}
