// Register stock (National Supplier). Posts the batch, then shows the
// generated QR with a download link. Two-column: form on the left, a
// sticky result panel on the right.

import { useState } from 'react';
import { PackagePlus, Download, CheckCircle2, QrCode } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEMO_DEPOTS } from '../lib/demoDepots';

function emptyForm() {
  return {
    batch_number: '',
    fertiliser_type: '',
    quantity: '',
    manufacture_date: '',
    expiry_date: '',
    destination: '',
  };
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

export default function RegisterStock() {
  const { user } = useAuth();
  const responsiblePersonnel = user?.name || '';
  const todayDate = formatDateInputValue(new Date());
  const minimumExpiryDate = formatDateInputValue(addDays(new Date(), 30));
  const [form, setForm] = useState(() => emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [qrUrl, setQrUrl] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    setResult(null);
    setQrUrl('');
    try {
      const res = await api.post('/stock', {
        ...form,
        quantity: Number(form.quantity),
        source: responsiblePersonnel,
        responsible_personnel: responsiblePersonnel,
      });
      setResult(res.data);
      const img = await api.get(`/stock/${res.data.stock_id}/qr`, { responseType: 'blob' });
      setQrUrl(URL.createObjectURL(img.data));
      setForm(emptyForm());
    } catch (err) {
      setError(err.response?.data?.error || 'Could not register the batch. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Register stock</h1>
        <p className="mt-1 text-sm text-mute">
          Enter batch details to create a record and generate its QR identifier.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card-shadow rounded-lg border border-line bg-card p-6">
          <SectionLabel>Batch</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Batch number" required>
              <input value={form.batch_number} onChange={(e) => update('batch_number', e.target.value)} required placeholder="NPK-2026-001" className="field-input font-mono" />
            </Field>
            <Field label="Fertiliser type" required>
              <input value={form.fertiliser_type} onChange={(e) => update('fertiliser_type', e.target.value)} required placeholder="NPK 23:23:0" className="field-input" />
            </Field>
            <Field label="Quantity (bags)" required>
              <input type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} required className="field-input tabular-nums" />
            </Field>
            <Field label="Responsible personnel" required>
              <input value={responsiblePersonnel} readOnly required placeholder="Account holder name" className="field-input cursor-not-allowed bg-canvas text-mute" />
            </Field>
          </div>

          <SectionLabel className="mt-6">Dates</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manufacture date" required>
              <input type="date" max={todayDate} value={form.manufacture_date} onChange={(e) => update('manufacture_date', e.target.value)} required className="field-input" />
            </Field>
            <Field label="Expiry date" required>
              <input type="date" min={minimumExpiryDate} value={form.expiry_date} onChange={(e) => update('expiry_date', e.target.value)} required className="field-input" />
            </Field>
          </div>

          <SectionLabel className="mt-6">Route</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source" required>
              <input value={responsiblePersonnel} readOnly required placeholder="Supplier organisation" className="field-input cursor-not-allowed bg-canvas text-mute" />
            </Field>
            <Field label="Destination" required>
              <select value={form.destination} onChange={(e) => update('destination', e.target.value)} required className="field-input">
                <option value="">Select destination</option>
                {DEMO_DEPOTS.map((depot) => (
                  <option key={depot} value={depot}>{depot}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <div className="mt-5 rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
          >
            <PackagePlus size={16} />
            {busy ? 'Registering...' : 'Register & generate QR'}
          </button>
        </form>

        {/* QR result */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="card-shadow rounded-lg border border-line bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <QrCode size={16} className="text-moss" /> QR identifier
            </div>

            {!result && (
              <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-line py-10 text-center">
                <QrCode size={32} className="text-line" />
                <p className="mt-2 px-6 text-xs text-mute">
                  The generated code appears here after you register a batch.
                </p>
              </div>
            )}

            {result && (
              <div className="mt-4 animate-rise">
                {qrUrl ? (
                  <img src={qrUrl} alt="Batch QR code" className="mx-auto h-44 w-44 rounded-lg border border-line" />
                ) : (
                  <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-line text-xs text-mute">
                    Loading...
                  </div>
                )}
                <p className="mt-4 break-all text-center font-mono text-xs text-mute">
                  {result.qr_payload}
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-moss">
                  <CheckCircle2 size={15} />
                  <span className="text-xs font-medium">Registered & recorded</span>
                </div>
                {qrUrl && (
                  <a
                    href={qrUrl}
                    download={`${result.qr_payload}.png`}
                    className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
                  >
                    <Download size={15} /> Download QR
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}{required && <span className="text-clay"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SectionLabel({ children, className = '' }) {
  return (
    <div className={`mb-3 text-xs font-semibold uppercase tracking-wide text-mute ${className}`}>
      {children}
    </div>
  );
}
