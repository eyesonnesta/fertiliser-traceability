// Login - split screen. Left: field-route preview. Right: the sign-in form.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, ArrowRight, CheckCircle2, PackageCheck, QrCode, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not sign in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="field-hero hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-leaf shadow-lg shadow-black/20">
            <Leaf size={20} className="text-forest" strokeWidth={2.5} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-forest bg-wheat" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">Mfuatano</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              fertiliser traceability
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="field-hero-badge mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
            <QrCode size={14} />
            QR custody field network
          </div>
          <h1 className="font-display max-w-lg text-5xl font-semibold leading-[1.08]">
            Every bag accounted for, from supplier to cooperative.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/72">
            A chain-of-custody console for Kenya's National Fertiliser Subsidy
            Programme. Register stock, generate verifiable QR identifiers, and
            trace every transfer along the way.
          </p>

          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
            <PreviewRow batch="FTRC-NPK-2026-001" label="Verified at Nakuru Depot" Icon={CheckCircle2} tone="text-leaf" />
            <PreviewRow batch="FTRC-CAN-2026-014" label="In transit to cooperative" Icon={Truck} tone="text-clay" />
          </div>

          <RouteVisual />
        </div>

        <div className="relative z-10 font-mono text-xs text-white/40">
          Strathmore University - School of Computing &amp; Engineering Sciences
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#f2e4d2] px-6 py-12">
        <div className="card-shadow w-full max-w-sm rounded-lg border border-line bg-card p-6 sm:p-7">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-moss">
              <Leaf size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-semibold">Mfuatano</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-mute">Use your programme account to continue.</p>

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

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Demo@12345"
                className="field-input"
              />
            </label>

            {error && (
              <div className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">{error}</div>
            )}

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-moss hover:text-forest"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-moss py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest disabled:opacity-50"
            >
              {busy ? 'Signing in...' : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-dashed border-line bg-card p-3 text-xs text-mute">
            <p className="font-medium text-ink">Demo accounts</p>
            <p className="mt-1 font-mono">supplier@demo.com - Demo@12345</p>
            <p className="font-mono">depot@demo.com - Demo@12345</p>
            <p className="font-mono">depot.nakuru@demo.com - Demo@12345</p>
            <p className="font-mono">coop@demo.com - Demo@12345</p>
            <p className="font-mono">coop.nakuru@demo.com - Demo@12345</p>
            <p className="font-mono">admin@demo.com - Demo@12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ batch, label, Icon, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-sm">
      <Icon size={16} className={tone} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-white/80">{batch}</div>
        <div className="truncate text-xs text-white/40">{label}</div>
      </div>
    </div>
  );
}

function RouteVisual() {
  return (
    <div className="route-visual mt-8 max-w-md rounded-lg border border-white/20 p-5 shadow-2xl shadow-black/20">
      <div className="flex min-h-24 items-end justify-between gap-4">
        <VisualNode Icon={Leaf} />
        <VisualNode Icon={Truck} />
        <VisualNode Icon={QrCode} />
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm font-semibold text-white">
        <PackageCheck size={15} />
        Live custody route
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
