// Movement page: dispatch stock to the next supply-chain role, then scan
// and receive dispatched stock. This is the Week 2 operational loop.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Play,
  QrCode,
  ScanLine,
  Square,
  Truck,
  UserRound,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import SupplyChainStepper from '../components/SupplyChainStepper';
import { ROLE_LABELS } from '../lib/labels';
import { useAuth } from '../context/AuthContext';

const CAN_DISPATCH = ['national_supplier', 'depot_manager'];
const CAN_RECEIVE = ['depot_manager', 'cooperative_official'];

export default function Movement() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const canDispatch = CAN_DISPATCH.includes(user?.role);
  const canReceive = CAN_RECEIVE.includes(user?.role);

  const [dispatchForm, setDispatchForm] = useState({
    stock_id: '',
    to_user_id: '',
    quantity: '',
  });
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchError, setDispatchError] = useState('');
  const [dispatchResult, setDispatchResult] = useState(null);

  const [payload, setPayload] = useState('');
  const [verified, setVerified] = useState(null);
  const [deliveryCondition, setDeliveryCondition] = useState('good');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveResult, setReceiveResult] = useState(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraMessage, setCameraMessage] = useState('Camera preview appears here.');
  const stableId = useId().replace(/:/g, '');
  const readerId = `qr-reader-${stableId}`;
  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);

  const loadMovementData = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    try {
      const [stockRes, transferRes] = await Promise.all([
        api.get('/stock'),
        api.get('/transfers'),
      ]);
      setStock(stockRes.data.stock || []);
      setTransfers(transferRes.data.transfers || []);

      if (canDispatch) {
        const recipientsRes = await api.get('/transfers/recipients');
        setRecipients(recipientsRes.data.users || []);
      }
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Could not load movement data.');
    } finally {
      setLoading(false);
    }
  }, [canDispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMovementData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMovementData]);

  const dispatchableStock = useMemo(() => (
    stock.filter((s) => (
      Number(s.held_quantity || 0) > 0
      && !['expired', 'recalled'].includes(s.status)
    ))
  ), [stock]);

  const selectedDispatchStock = useMemo(() => (
    dispatchableStock.find((s) => Number(s.id) === Number(dispatchForm.stock_id))
  ), [dispatchableStock, dispatchForm.stock_id]);

  async function handleDispatch(e) {
    e.preventDefault();
    setDispatchBusy(true);
    setDispatchError('');
    setDispatchResult(null);
    try {
      const res = await api.post('/transfers/dispatch', {
        stock_id: Number(dispatchForm.stock_id),
        to_user_id: Number(dispatchForm.to_user_id),
        quantity: Number(dispatchForm.quantity),
      });
      setDispatchResult(res.data);
      setDispatchForm({ stock_id: '', to_user_id: '', quantity: '' });
      await loadMovementData();
    } catch (err) {
      setDispatchError(err.response?.data?.error || 'Could not dispatch this batch.');
    } finally {
      setDispatchBusy(false);
    }
  }

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      await scanner.clear();
    } catch {
      // Stopping can fail if the camera was already released by the browser.
    } finally {
      scannerRef.current = null;
      setCameraActive(false);
      setCameraMessage('Camera preview appears here.');
    }
  }, []);

  const verifyPayload = useCallback(async (value) => {
    const cleanPayload = (value || payload).trim();
    if (!cleanPayload) {
      setReceiveError('QR payload is required.');
      return;
    }

    setVerifyBusy(true);
    setReceiveError('');
    setReceiveResult(null);
    setVerified(null);
    try {
      const res = await api.post('/transfers/verify', { qr_payload: cleanPayload });
      setPayload(cleanPayload);
      setVerified(res.data);
    } catch (err) {
      setReceiveError(err.response?.data?.error || 'Could not verify this QR code.');
    } finally {
      setVerifyBusy(false);
    }
  }, [payload]);

  async function startCamera() {
    setCameraBusy(true);
    setCameraError('');
    setCameraMessage('Opening camera...');
    scanLockedRef.current = false;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error('No camera found.');
      }

      // Use a real device id. On laptops there is often no "environment"
      // camera, so asking for that facingMode can open nothing.
      const preferredCamera = cameras.find((camera) =>
        /back|rear|environment/i.test(camera.label)
      ) || cameras[0];

      await scanner.start(
        preferredCamera.id,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (scanLockedRef.current) return;
          scanLockedRef.current = true;
          await stopCamera();
          await verifyPayload(decodedText);
        },
        () => {}
      );
      setCameraActive(true);
      setCameraMessage('');
    } catch (err) {
      await stopCamera();
      setCameraMessage('Camera preview appears here.');
      setCameraError(err.message || 'Camera scanner could not start.');
    } finally {
      setCameraBusy(false);
    }
  }

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  async function handleReceive(e) {
    e.preventDefault();
    if (!verified?.transfer?.id) {
      setReceiveError('Verify a dispatched batch first.');
      return;
    }

    setReceiveBusy(true);
    setReceiveError('');
    setReceiveResult(null);
    try {
      const res = await api.post('/transfers/receive', {
        transfer_id: verified.transfer.id,
        qr_payload: verified.stock.qr_payload || payload.trim(),
        delivery_condition: deliveryCondition,
      });
      setReceiveResult(res.data);
      setVerified(null);
      setPayload('');
      setDeliveryCondition('good');
      await loadMovementData();
    } catch (err) {
      setReceiveError(err.response?.data?.error || 'Could not confirm receipt.');
    } finally {
      setReceiveBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Stock movement</h1>
          <p className="mt-1 text-sm text-mute">
            Dispatch, scan, verify, and receive batches across the supply chain.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs text-mute sm:flex">
          <UserRound size={14} />
          {ROLE_LABELS[user?.role] || user?.role}
        </div>
      </header>

      {loadError && (
        <div className="mb-4 rounded-lg bg-alert-soft px-4 py-3 text-sm text-alert">
          {loadError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {canDispatch && (
          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <PanelHeader Icon={Truck} title="Dispatch" />

            {loading ? (
              <p className="mt-4 text-sm text-mute">Loading stock...</p>
            ) : (
              <form onSubmit={handleDispatch} className="mt-5 space-y-4">
                <Field label="Batch">
                  <select
                    className="field-input"
                    value={dispatchForm.stock_id}
                    onChange={(e) =>
                      setDispatchForm((f) => ({ ...f, stock_id: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select batch</option>
                    {dispatchableStock.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.batch_number} - {s.fertiliser_type} ({s.held_quantity} available)
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedDispatchStock && (
                  <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-mute">Available to dispatch</span>
                      <span className="font-mono font-medium text-ink">
                        {selectedDispatchStock.held_quantity} / {selectedDispatchStock.quantity} bags
                      </span>
                    </div>
                    {Number(selectedDispatchStock.in_transit_quantity || 0) > 0 && (
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                        <span className="text-mute">Already in transit</span>
                        <span className="font-mono text-clay">
                          {selectedDispatchStock.in_transit_quantity} bags
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <Field label="Receiver">
                  <select
                    className="field-input"
                    value={dispatchForm.to_user_id}
                    onChange={(e) =>
                      setDispatchForm((f) => ({ ...f, to_user_id: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select receiver</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.depot_scope || ROLE_LABELS[r.role] || r.role}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Bags to dispatch">
                  <input
                    type="number"
                    min="1"
                    max={selectedDispatchStock?.held_quantity || undefined}
                    className="field-input tabular-nums"
                    value={dispatchForm.quantity}
                    onChange={(e) =>
                      setDispatchForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    required
                    placeholder="0"
                  />
                </Field>

                {dispatchableStock.length === 0 && (
                  <EmptyNotice icon={<AlertTriangle size={16} />} text="No dispatchable batches." />
                )}

                {dispatchError && (
                  <div className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">
                    {dispatchError}
                  </div>
                )}

                {dispatchResult && (
                  <SuccessNotice
                    text={`${dispatchResult.quantity} bag(s) dispatched to ${dispatchResult.to_user.name}. Transfer #${dispatchResult.transfer_id}.`}
                  />
                )}

                <button
                  type="submit"
                  disabled={dispatchBusy || dispatchableStock.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
                >
                  <Truck size={16} />
                  {dispatchBusy ? 'Dispatching...' : 'Dispatch batch'}
                </button>
              </form>
            )}
          </section>
        )}

        {canReceive && (
          <section className="card-shadow rounded-lg border border-line bg-card p-6">
            <PanelHeader Icon={ScanLine} title="Scan and receive" />

            <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="relative min-h-[220px] overflow-hidden rounded-lg border border-line bg-canvas">
                  <div id={readerId} className="min-h-[220px]" />
                  {!cameraActive && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-mute">
                      <QrCode size={34} className="text-mute/40" />
                      <span>{cameraMessage}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraBusy || cameraActive}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
                  >
                    <Play size={15} />
                    {cameraBusy ? 'Opening...' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    disabled={!cameraActive}
                    className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-ink transition-colors hover:bg-canvas disabled:opacity-50"
                    title="Stop camera"
                  >
                    <Square size={15} />
                  </button>
                </div>
                {cameraError && (
                  <div className="mt-3 rounded-lg bg-alert-soft px-3 py-2 text-xs text-alert">
                    {cameraError}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <Field label="QR payload">
                  <textarea
                    className="field-input min-h-24 resize-y font-mono text-xs"
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="FTRC-NPK-2026-001-..."
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => verifyPayload(payload)}
                  disabled={verifyBusy}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
                >
                  <QrCode size={16} />
                  {verifyBusy ? 'Verifying...' : 'Verify QR'}
                </button>
              </div>
            </div>

            {receiveError && (
              <div className="mt-4 rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">
                {receiveError}
              </div>
            )}

            {receiveResult && (
              <SuccessNotice
                className="mt-4"
                text={`Received ${receiveResult.quantity} bag(s) on transfer #${receiveResult.transfer_id}. Custody updated.`}
              />
            )}

            {verified && (
              <form onSubmit={handleReceive} className="mt-5 border-t border-line pt-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-all font-mono text-sm text-ink">
                      {verified.stock.batch_number}
                    </div>
                    <div className="mt-1 break-words text-sm text-mute">
                      {verified.stock.fertiliser_type} - transfer of {verified.transfer.quantity} bag(s)
                    </div>
                  </div>
                  <StatusBadge status={verified.stock.status} />
                </div>

                <SupplyChainStepper
                  holderRole={verified.stock.holder_role}
                  status={verified.stock.status}
                />

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <MiniFact label="Dispatched by" value={verified.transfer.from_user_name} />
                  <MiniFact label="Receiving as" value={verified.transfer.to_user_name} />
                  <MiniFact label="Transfer quantity" value={`${verified.transfer.quantity} bags`} />
                  <MiniFact label="Batch total" value={`${verified.stock.quantity} bags`} />
                </div>

                <Field label="Delivery condition" className="mt-4">
                  <select
                    className="field-input"
                    value={deliveryCondition}
                    onChange={(e) => setDeliveryCondition(e.target.value)}
                    required
                  >
                    <option value="good">Good</option>
                    <option value="sealed intact">Sealed intact</option>
                    <option value="partially damaged">Partially damaged</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </Field>

                <button
                  type="submit"
                  disabled={receiveBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
                >
                  <PackageCheck size={16} />
                  {receiveBusy ? 'Receiving...' : 'Confirm receipt'}
                </button>
              </form>
            )}
          </section>
        )}
      </div>

      <TransferLedger transfers={transfers} user={user} loading={loading} />
    </div>
  );
}

function PanelHeader({ Icon, title }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf-soft text-moss">
        <Icon size={17} />
      </span>
      <span className="truncate">{title}</span>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function MiniFact({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2">
      <div className="text-xs text-mute">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function EmptyNotice({ icon, text }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-wheat-soft px-3 py-2 text-sm text-ink">
      <span className="text-wheat">{icon}</span>
      <span className="break-words">{text}</span>
    </div>
  );
}

function SuccessNotice({ text, className = '' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg bg-leaf-soft px-3 py-2 text-sm text-moss ${className}`}>
      <CheckCircle2 size={16} />
      <span className="break-words">{text}</span>
    </div>
  );
}

function TransferLedger({ transfers, user, loading }) {
  const openForMe = transfers.filter((transfer) => (
    transfer.status === 'dispatched'
    && Number(transfer.to_user_id) === Number(user?.id)
  ));
  const openSent = transfers.filter((transfer) => (
    transfer.status === 'dispatched'
    && Number(transfer.from_user_id) === Number(user?.id)
  ));

  return (
    <section className="card-shadow mt-5 rounded-lg border border-line bg-card p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf-soft text-moss">
              <ClipboardList size={17} />
            </span>
            Movement ledger
          </div>
          <p className="mt-2 text-sm text-mute">
            Open dispatches still require QR verification before receipt is confirmed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MiniFact label="Awaiting me" value={openForMe.length} />
          <MiniFact label="Sent open" value={openSent.length} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-mute">Loading transfers...</p>
      ) : transfers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center text-sm text-mute">
          No transfer records yet.
        </div>
      ) : (
        <div className="table-shell">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-mute">
                <th className="px-4 py-3 font-medium">Transfer</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Bags</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-ink">#{transfer.id}</div>
                    <div className="mt-0.5 break-all font-mono text-xs text-mute">{transfer.batch_number}</div>
                    <div className="mt-0.5 break-words text-xs text-mute">{transfer.fertiliser_type}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="break-words text-ink">{transfer.from_user_name}</div>
                    <div className="mt-0.5 text-xs text-mute">
                      to {transfer.to_user_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-medium text-ink">
                    {transfer.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <TransferStatusPill status={transfer.status} />
                    {transfer.delivery_condition && (
                      <div className="mt-1 text-xs text-mute">{transfer.delivery_condition}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-mute">
                    {formatDateTime(transfer.received_at || transfer.dispatched_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TransferStatusPill({ status }) {
  const cls = status === 'received'
    ? 'bg-leaf-soft text-moss'
    : status === 'rejected'
      ? 'bg-alert-soft text-alert'
      : 'bg-wheat-soft text-ink';

  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
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
