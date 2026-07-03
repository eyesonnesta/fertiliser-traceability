// Stock detail — one batch: the supply-chain stepper, batch facts, QR,
// and the chain-of-custody timeline.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Download,
  Edit3,
  FileSpreadsheet,
  Hash,
  MapPin,
  QrCode,
  RotateCcw,
  Save,
  User,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import SupplyChainStepper from '../components/SupplyChainStepper';
import { useAuth } from '../context/AuthContext';
import { DEMO_DEPOTS } from '../lib/demoDepots';
import { ROLE_LABELS } from '../lib/labels';

export default function StockDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activeQrUrl = '';
    api
      .get(`/stock/${id}`)
      .then((res) => {
        setData(res.data);
        return api.get(`/stock/${id}/qr`, { responseType: 'blob' });
      })
      .then((img) => {
        activeQrUrl = URL.createObjectURL(img.data);
        setQrUrl(activeQrUrl);
      })
      .catch((err) => setError(err.response?.data?.error || 'Could not load this batch.'))
      .finally(() => setLoading(false));

    return () => {
      if (activeQrUrl) {
        URL.revokeObjectURL(activeQrUrl);
      }
    };
  }, [id]);

  if (loading) return <p className="text-sm text-mute">Loading...</p>;
  if (error)
    return <div className="rounded-lg bg-alert-soft px-4 py-3 text-sm text-alert">{error}</div>;

  const {
    stock,
    qr_payload,
    custody_history,
    holdings = [],
    distributions = [],
  } = data;
  const isArchived = Boolean(stock.is_archived);
  const canAdminManage = user?.role === 'system_administrator';
  const canSupplierEdit = user?.role === 'national_supplier'
    && stock.status === 'registered'
    && !isArchived;
  const canUpdateStock = canAdminManage || canSupplierEdit;
  const todayDate = formatDateInputValue(new Date());
  const minimumExpiryDate = formatDateInputValue(addDays(new Date(), 30));

  async function exportAuditCsv() {
    setExportBusy(true);
    setError('');
    try {
      const res = await api.get('/reports/custody.csv', {
        params: { stock_id: id },
        responseType: 'blob',
      });
      const href = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${stock.batch_number}-custody.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not export this batch audit.');
    } finally {
      setExportBusy(false);
    }
  }

  async function refreshStockData() {
    const res = await api.get(`/stock/${id}`);
    setData(res.data);
    return res.data.stock;
  }

  function openEditForm() {
    setError('');
    setSuccess('');
    setEditForm({
      fertiliser_type: stock.fertiliser_type || '',
      quantity: String(stock.quantity || ''),
      manufacture_date: toInputDate(stock.manufacture_date),
      expiry_date: toInputDate(stock.expiry_date),
      source: stock.source || '',
      destination: stock.destination || '',
      responsible_personnel: stock.responsible_personnel || '',
    });
    setEditOpen(true);
  }

  function updateEditField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function handleStockUpdate(e) {
    e.preventDefault();
    setActionBusy('update');
    setError('');
    setSuccess('');
    try {
      await api.patch(`/stock/${id}`, {
        ...editForm,
        quantity: Number(editForm.quantity),
      });
      await refreshStockData();
      setEditOpen(false);
      setSuccess('Stock updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update stock.');
    } finally {
      setActionBusy('');
    }
  }

  async function handleArchiveAction(action) {
    setActionBusy(action);
    setError('');
    setSuccess('');
    try {
      const res = await api.patch(`/stock/${id}/${action}`);
      await refreshStockData();
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || `Could not ${action} stock.`);
    } finally {
      setActionBusy('');
    }
  }

  return (
    <div className="animate-rise">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink">
        <ArrowLeft size={15} /> Back to ledger
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-all font-mono text-xl text-ink">{stock.batch_number}</div>
          <p className="mt-1 break-words text-mute">{stock.fertiliser_type}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canUpdateStock && (
            <button
              type="button"
              onClick={openEditForm}
              disabled={Boolean(actionBusy)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
            >
              <Edit3 size={15} />
              Edit
            </button>
          )}
          {canAdminManage && !isArchived && (
            <button
              type="button"
              onClick={() => handleArchiveAction('archive')}
              disabled={Boolean(actionBusy)}
              className="inline-flex items-center gap-2 rounded-lg border border-alert/25 bg-alert-soft px-3 py-2 text-sm font-medium text-alert transition-colors hover:bg-alert-soft/70 disabled:opacity-50"
            >
              <Archive size={15} />
              {actionBusy === 'archive' ? 'Archiving...' : 'Archive'}
            </button>
          )}
          {canAdminManage && isArchived && (
            <button
              type="button"
              onClick={() => handleArchiveAction('restore')}
              disabled={Boolean(actionBusy)}
              className="inline-flex items-center gap-2 rounded-lg border border-moss/25 bg-leaf-soft px-3 py-2 text-sm font-medium text-moss transition-colors hover:bg-leaf-soft/70 disabled:opacity-50"
            >
              <RotateCcw size={15} />
              {actionBusy === 'restore' ? 'Restoring...' : 'Restore'}
            </button>
          )}
          <button
            type="button"
            onClick={exportAuditCsv}
            disabled={exportBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            {exportBusy ? 'Exporting...' : 'Export audit'}
          </button>
          <StatusBadge status={stock.status} />
          {isArchived && (
            <span className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-mute">
              Archived
            </span>
          )}
        </div>
      </header>

      {success && (
        <div className="mt-4 rounded-lg bg-leaf-soft px-4 py-3 text-sm text-moss">{success}</div>
      )}

      {isArchived && (
        <div className="mt-4 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-mute">
          Archived {formatDate(stock.archived_at)} by {stock.archived_by_name || 'administrator'}.
        </div>
      )}

      {/* Stepper */}
      <div className="card-shadow mt-6 rounded-lg border border-line bg-card p-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-mute">
          Supply chain position
        </div>
        <SupplyChainStepper holderRole={stock.holder_role} status={stock.status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Facts + custody */}
        <div className="space-y-4">
          <div className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-ink">Batch details</div>
              {canUpdateStock && !editOpen && (
                <button
                  type="button"
                  onClick={openEditForm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
                >
                  <Edit3 size={13} />
                  Edit
                </button>
              )}
            </div>
            {editOpen && editForm && (
              <form onSubmit={handleStockUpdate} className="mb-5 rounded-lg border border-line bg-canvas p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditField label="Fertiliser type">
                    <input className="field-input" value={editForm.fertiliser_type} onChange={(e) => updateEditField('fertiliser_type', e.target.value)} required />
                  </EditField>
                  <EditField label="Quantity">
                    <input className="field-input tabular-nums" type="number" min="1" value={editForm.quantity} onChange={(e) => updateEditField('quantity', e.target.value)} required />
                  </EditField>
                  <EditField label="Manufactured">
                    <input className="field-input" type="date" max={todayDate} value={editForm.manufacture_date} onChange={(e) => updateEditField('manufacture_date', e.target.value)} required />
                  </EditField>
                  <EditField label="Expires">
                    <input className="field-input" type="date" min={minimumExpiryDate} value={editForm.expiry_date} onChange={(e) => updateEditField('expiry_date', e.target.value)} required />
                  </EditField>
                  <EditField label="Responsible">
                    <input className="field-input" value={editForm.responsible_personnel} onChange={(e) => updateEditField('responsible_personnel', e.target.value)} required />
                  </EditField>
                  <EditField label="Source">
                    <input className="field-input" value={editForm.source} onChange={(e) => updateEditField('source', e.target.value)} required />
                  </EditField>
                  <EditField label="Destination">
                    <select className="field-input" value={editForm.destination} onChange={(e) => updateEditField('destination', e.target.value)} required>
                      <option value="">Select destination</option>
                      {editForm.destination && !DEMO_DEPOTS.includes(editForm.destination) && (
                        <option value={editForm.destination}>{editForm.destination}</option>
                      )}
                      {DEMO_DEPOTS.map((depot) => (
                        <option key={depot} value={depot}>{depot}</option>
                      ))}
                    </select>
                  </EditField>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={actionBusy === 'update'}
                    className="inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-50"
                  >
                    <Save size={15} />
                    {actionBusy === 'update' ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    disabled={actionBusy === 'update'}
                    className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Fact Icon={Hash} label="Quantity" value={`${stock.quantity} bags`} />
              <Fact Icon={Hash} label="You hold" value={`${stock.held_quantity || 0} bags`} />
              <Fact Icon={Hash} label="In transit" value={`${stock.in_transit_quantity || 0} bags`} />
              <Fact Icon={Hash} label="Issued" value={`${stock.issued_quantity || 0} bags`} />
              <Fact Icon={User} label="Current holder" value={formatHolder(stock)} />
              <Fact Icon={User} label="Responsible" value={stock.responsible_personnel} />
              <Fact Icon={MapPin} label="Registered source" value={stock.source} />
              <Fact Icon={MapPin} label="Registered destination" value={stock.destination} />
              <Fact Icon={Calendar} label="Manufactured" value={formatDate(stock.manufacture_date)} />
              <Fact Icon={Calendar} label="Expires" value={formatDate(stock.expiry_date)} />
            </div>
          </div>

          {distributions.length > 0 && (
            <div className="card-shadow rounded-lg border border-line bg-card p-6">
              <div className="mb-4 text-sm font-medium text-ink">Issue records</div>
              <div className="space-y-3">
                {distributions.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-line bg-canvas px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium text-ink">{record.recipient_name}</div>
                      <div className="mt-0.5 text-xs text-mute">
                        {record.location || 'Location not recorded'} - {formatDate(record.issued_at)}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-medium tabular-nums text-ink">
                      {record.quantity} bags
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 text-sm font-medium text-ink">Current holdings</div>
            {holdings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-mute">
                No bags are currently held by a user.
              </p>
            ) : (
              <div className="space-y-3">
                {holdings.map((h) => (
                  <div
                    key={`${h.user_id}-${h.user_role}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium text-ink">{h.user_name}</div>
                      <div className="text-xs text-mute">
                        {ROLE_LABELS[h.user_role] || h.user_role}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-medium tabular-nums text-ink">
                      {h.quantity} bags
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="mb-4 text-sm font-medium text-ink">Chain of custody</div>
            <ol className="space-y-0">
              {custody_history.map((entry, i) => (
                <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < custody_history.length - 1 && (
                    <span className="absolute left-[11px] top-6 h-full w-px bg-line" />
                  )}
                  <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft">
                    <span className="h-2 w-2 rounded-full bg-moss" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium capitalize text-ink">{entry.action}</div>
                    <div className="text-xs text-mute">
                      {entry.user_name} · {ROLE_LABELS[entry.user_role] || entry.user_role}
                    </div>
                    <div className="text-xs text-mute/70">
                      {new Date(entry.created_at).toLocaleString('en-GB')}
                    </div>
                    {entry.notes && <div className="mt-1 break-words text-xs text-mute">{entry.notes}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* QR */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="card-shadow rounded-lg border border-line bg-card p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-ink">
              <QrCode size={16} className="text-moss" /> QR identifier
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt="Batch QR" className="mx-auto mt-4 h-40 w-40 rounded-lg border border-line" />
            ) : (
              <div className="mx-auto mt-4 h-40 w-40 rounded-lg border border-dashed border-line" />
            )}
            <p className="mt-3 break-all font-mono text-xs text-mute">{qr_payload}</p>
            {qrUrl && (
              <a
                href={qrUrl}
                download={`${stock.batch_number}-qr.png`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest"
              >
                <Download size={15} />
                Download QR
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas">
        <Icon size={14} className="text-mute" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-mute">{label}</div>
        <div className="break-words text-sm font-medium text-ink">{value}</div>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function EditField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-mute">{label}</span>
      {children}
    </label>
  );
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateInputValue(date);
}

function formatHolder(stock) {
  if (!stock.holder_name) return 'Not assigned';
  const role = ROLE_LABELS[stock.holder_role] || stock.holder_role;
  return role ? `${stock.holder_name} (${role})` : stock.holder_name;
}
