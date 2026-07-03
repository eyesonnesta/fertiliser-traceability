// Dashboard: stock overview with metrics, movement pressure, fertiliser mix,
// and the live ledger.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Leaf,
  PackageCheck,
  PackagePlus,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import SupplyChainStepper from '../components/SupplyChainStepper';
import { useAuth } from '../context/AuthContext';

const BAR_COLORS = ['#236a45', '#3f9f67', '#a85d32', '#9c641f', '#5f6a60', '#162119'];
const DEFAULT_LEDGER_FILTERS = {
  search: '',
  status: '',
  type: '',
  expiryStatus: '',
  sort: 'latest',
  page: 1,
  limit: 20,
};
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'registered', label: 'Registered' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'expired', label: 'Expired' },
  { value: 'recalled', label: 'Recalled' },
];
const EXPIRY_OPTIONS = [
  { value: '', label: 'All expiry' },
  { value: 'valid', label: 'Valid' },
  { value: 'expiringSoon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
];
const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'expiry_date', label: 'Expiry date' },
];
const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function Dashboard() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [summaryStock, setSummaryStock] = useState([]);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState(DEFAULT_LEDGER_FILTERS);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canRegister = user?.role === 'national_supplier';
  const activeFilterCount = [
    ledgerFilters.search,
    ledgerFilters.status,
    ledgerFilters.type,
    ledgerFilters.expiryStatus,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    let ignore = false;
    api
      .get('/stock')
      .then((res) => {
        if (!ignore) {
          setSummaryStock(res.data.stock || []);
          setSummaryLoaded(true);
        }
      })
      .catch(() => {
        if (!ignore) setSummaryLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    api
      .get('/stock', { params: buildStockQueryParams(ledgerFilters) })
      .then((res) => {
        if (ignore) return;
        setStock(res.data.stock || []);
        setPagination(normalizePagination(res.data.pagination, ledgerFilters));
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.response?.data?.error || 'Could not load the stock ledger.');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [ledgerFilters]);

  const summaryRows = summaryLoaded ? summaryStock : stock;
  const stats = useMemo(() => {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(now.getDate() + 30);

    const total = summaryRows.length;
    const bags = summaryRows.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
    const inTransit = summaryRows.filter((s) => s.status === 'in_transit').length;
    const attention = summaryRows.filter((s) =>
      ['expired', 'recalled'].includes(s.status)
    ).length;
    const expiringSoon = summaryRows.filter((s) => {
      const expiry = s.expiry_date ? new Date(s.expiry_date) : null;
      return expiry && expiry >= now && expiry <= soon && !['expired', 'recalled'].includes(s.status);
    }).length;
    const ready = summaryRows.filter((s) => ['registered', 'received'].includes(s.status)).length;

    return { total, bags, inTransit, attention, expiringSoon, ready };
  }, [summaryRows]);

  const chartData = useMemo(() => {
    const map = {};
    for (const s of summaryRows) {
      map[s.fertiliser_type] = (map[s.fertiliser_type] || 0) + Number(s.quantity || 0);
    }
    return Object.entries(map)
      .map(([name, bags]) => ({ name, bags }))
      .sort((a, b) => b.bags - a.bags)
      .slice(0, 6);
  }, [summaryRows]);

  const typeOptions = useMemo(() => (
    Array.from(new Set(summaryRows.map((s) => s.fertiliser_type).filter(Boolean))).sort()
  ), [summaryRows]);

  const updateFilter = (field, value) => {
    setLoading(true);
    setError('');
    setLedgerFilters((current) => ({
      ...current,
      [field]: value,
      page: 1,
    }));
  };

  const updatePage = (page) => {
    setLoading(true);
    setError('');
    setLedgerFilters((current) => ({
      ...current,
      page,
    }));
  };

  const resetFilters = () => {
    setLoading(true);
    setError('');
    setLedgerFilters(DEFAULT_LEDGER_FILTERS);
  };

  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const pageEnd = Math.min(pagination.page * pagination.limit, pagination.total);
  const canGoPrevious = pagination.page > 1 && !loading;
  const canGoNext = pagination.page < pagination.totalPages && !loading;

  return (
    <div className="animate-rise">
      <header className="console-panel mb-6 overflow-hidden rounded-lg border border-line">
        <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-mute">
              <ShieldCheck size={14} className="text-moss" />
              Live stock ledger
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
              Fertiliser custody at a glance
            </h1>
            <p className="mt-2 text-sm leading-6 text-mute">
              Track registered batches, current custody, movement pressure, and stock that needs action.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid w-fit grid-cols-3 gap-2 rounded-lg border border-line bg-white/75 p-2">
                <HeaderMetric label="Ready" value={stats.ready} />
                <HeaderMetric label="Transit" value={stats.inTransit} />
                <HeaderMetric label="Alerts" value={stats.attention + stats.expiringSoon} />
              </div>
              {canRegister && (
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-moss px-4 text-sm font-medium text-white transition-colors hover:bg-forest"
                >
                  <PackagePlus size={16} /> Register stock
                </Link>
              )}
            </div>
          </div>

          <DashboardRoutePanel />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Batches" value={stats.total} Icon={Boxes} tone="moss" />
        <StatCard label="Total bags" value={stats.bags.toLocaleString()} Icon={PackageCheck} tone="moss" />
        <StatCard label="In transit" value={stats.inTransit} Icon={Truck} tone="clay" />
        <StatCard label="Needs attention" value={stats.attention + stats.expiringSoon} Icon={AlertTriangle} tone="wheat" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_360px]">
        {chartData.length > 0 && (
          <section className="card-shadow rounded-lg border border-line bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">Bags by fertiliser type</div>
                <div className="mt-0.5 text-xs text-mute">Top stock categories by registered quantity</div>
              </div>
              <PackageCheck size={18} className="text-moss" />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7a70' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={shortLabel}
                  />
                  <Tooltip
                    cursor={{ fill: '#f4f5f1' }}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e3e6e0',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="bags" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="card-shadow rounded-lg border border-line bg-card p-4 sm:p-5">
          <div className="mb-4 text-sm font-medium text-ink">Operational watchlist</div>
          <div className="space-y-3">
            <WatchItem
              Icon={PackageCheck}
              label="Batches ready for movement"
              value={stats.ready}
              tone="moss"
            />
            <WatchItem
              Icon={Truck}
              label="Batches currently in transit"
              value={stats.inTransit}
              tone="clay"
            />
            <WatchItem
              Icon={AlertTriangle}
              label="Expired, recalled, or expiring soon"
              value={stats.attention + stats.expiringSoon}
              tone={stats.attention + stats.expiringSoon > 0 ? 'alert' : 'moss'}
            />
          </div>
        </section>
      </div>

      <section className="mt-4">
        <div className="card-shadow mb-3 rounded-lg border border-line bg-card p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">Stock ledger controls</div>
              <div className="mt-0.5 text-xs text-mute">
                {hasActiveFilters
                  ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
                  : 'Search and filter visible stock without changing role access.'}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-medium text-mute">
              {pagination.total.toLocaleString()} matching batch{pagination.total === 1 ? '' : 'es'}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr_1fr_0.8fr_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Search</span>
              <span className="relative block">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
                />
                <input
                  value={ledgerFilters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Batch or type"
                  className="field-input pl-9"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Status</span>
              <select
                value={ledgerFilters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="field-input"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Type</span>
              <select
                value={ledgerFilters.type}
                onChange={(e) => updateFilter('type', e.target.value)}
                className="field-input"
              >
                <option value="">All types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Expiry</span>
              <select
                value={ledgerFilters.expiryStatus}
                onChange={(e) => updateFilter('expiryStatus', e.target.value)}
                className="field-input"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Sort</span>
              <select
                value={ledgerFilters.sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="field-input"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">Rows</span>
              <select
                value={ledgerFilters.limit}
                onChange={(e) => updateFilter('limit', Number(e.target.value))}
                className="field-input"
              >
                {LIMIT_OPTIONS.map((limit) => (
                  <option key={limit} value={limit}>{limit}</option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters && ledgerFilters.sort === 'latest' && ledgerFilters.limit === 20}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:border-moss hover:bg-leaf-soft disabled:cursor-not-allowed disabled:opacity-55 xl:w-auto"
              >
                <RotateCcw size={15} />
                Reset
              </button>
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-mute">Loading ledger...</p>}

        {error && (
          <div className="rounded-lg bg-alert-soft px-4 py-3 text-sm text-alert">{error}</div>
        )}

        {!loading && !error && stock.length === 0 && (
          <div className="card-shadow rounded-lg border border-dashed border-line bg-card p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-leaf-soft">
              <PackagePlus size={22} className="text-moss" />
            </div>
            <p className="text-sm font-medium text-ink">
              {hasActiveFilters ? 'No stock matches the selected filters' : 'No batches registered yet'}
            </p>
            <p className="mt-1 text-sm text-mute">
              {hasActiveFilters
                ? 'Adjust the search, status, type, or expiry filter to widen the ledger results.'
                : canRegister
                ? 'Register the first fertiliser batch to start the ledger.'
                : 'No batches are currently visible for this account.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
              >
                <RotateCcw size={15} />
                Reset filters
              </button>
            ) : canRegister && (
              <Link
                to="/register"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-forest"
              >
                Register stock <ArrowRight size={15} />
              </Link>
            )}
          </div>
        )}

        {!loading && !error && stock.length > 0 && (
          <div className="table-shell card-shadow">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/80 text-left text-xs uppercase tracking-wide text-mute">
                  <th className="px-4 py-3 font-semibold sm:px-5">Batch</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Type</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Bags</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Chain</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Expiry</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Status</th>
                  <th className="px-4 py-3 sm:px-5" />
                </tr>
              </thead>
              <tbody>
                {stock.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-line/70 transition-colors last:border-0 ${
                      s.is_archived ? 'bg-canvas/70 text-mute' : 'hover:bg-leaf-soft/45'
                    }`}
                  >
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-canvas px-2 py-1 font-mono text-xs font-medium text-ink break-all">
                          {s.batch_number}
                        </span>
                        {Boolean(s.is_archived) && (
                          <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold text-mute">
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-ink sm:px-5">{s.fertiliser_type}</td>
                    <td className="px-4 py-3.5 tabular-nums text-ink sm:px-5">{s.quantity}</td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <SupplyChainStepper holderRole={s.holder_role} status={s.status} compact />
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-mute sm:px-5">
                      {formatDate(s.expiry_date)}
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right sm:px-5">
                      <Link
                        to={`/stock/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-moss transition-colors hover:bg-leaf-soft hover:text-forest"
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

        {!loading && !error && pagination.total > 0 && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-card px-4 py-3 text-sm text-mute sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing <span className="font-medium text-ink">{pageStart}</span>
              {' '}to <span className="font-medium text-ink">{pageEnd}</span>
              {' '}of <span className="font-medium text-ink">{pagination.total}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updatePage(pagination.page - 1)}
                disabled={!canGoPrevious}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:border-moss hover:bg-leaf-soft disabled:cursor-not-allowed disabled:opacity-55"
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <span className="min-w-24 text-center text-xs font-medium uppercase tracking-wide text-mute">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => updatePage(pagination.page + 1)}
                disabled={!canGoNext}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:border-moss hover:bg-leaf-soft disabled:cursor-not-allowed disabled:opacity-55"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function buildStockQueryParams(filters) {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  const type = filters.type.trim();

  if (search) params.set('search', search);
  if (filters.status) params.set('status', filters.status);
  if (type) params.set('type', type);
  if (filters.expiryStatus) params.set('expiryStatus', filters.expiryStatus);

  params.set('sort', filters.sort);
  params.set('order', orderForSort(filters.sort));
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  return params;
}

function orderForSort(sort) {
  if (sort === 'oldest' || sort === 'expiry_date') return 'asc';
  return 'desc';
}

function normalizePagination(pagination, filters) {
  return {
    page: Number(pagination?.page || filters.page),
    limit: Number(pagination?.limit || filters.limit),
    total: Number(pagination?.total || 0),
    totalPages: Number(pagination?.totalPages || 0),
  };
}

function HeaderMetric({ label, value }) {
  return (
    <div className="min-w-20 rounded-md bg-white px-3 py-2 text-center shadow-sm">
      <div className="font-display text-xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-mute">{label}</div>
    </div>
  );
}

function DashboardRoutePanel() {
  return (
    <div className="hidden min-h-56 p-5 lg:block">
      <div className="route-visual relative h-full rounded-lg border border-white/30 p-5 shadow-2xl shadow-black/10">
        <div className="flex h-full min-h-40 items-center justify-between gap-4">
          <VisualNode Icon={Leaf} />
          <VisualNode Icon={Truck} />
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-sm">
            <QrCode size={34} />
          </div>
        </div>
        <div className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm font-semibold text-white">
          <PackageCheck size={15} />
          Custody route active
        </div>
      </div>
    </div>
  );
}

function VisualNode({ Icon }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-black/30 text-white/85 backdrop-blur-sm">
      <Icon size={18} />
    </div>
  );
}

function WatchItem({ Icon, label, value, tone }) {
  const tones = {
    moss: 'bg-leaf-soft text-moss',
    clay: 'bg-clay-soft text-clay',
    alert: 'bg-alert-soft text-alert',
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.moss}`}>
          <Icon size={16} />
        </div>
        <div className="break-words text-sm leading-5 text-ink">{label}</div>
      </div>
      <div className="font-mono text-sm font-medium tabular-nums text-ink">{value}</div>
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

function shortLabel(value) {
  const text = String(value || '');
  return text.length > 12 ? `${text.slice(0, 11)}...` : text;
}
