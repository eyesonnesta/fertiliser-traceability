// Responsive application chrome. Desktop gets a fixed sidebar; smaller screens
// get a compact top rail with scrollable navigation for demo usability.

import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  HandCoins,
  KeyRound,
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  Leaf,
  LogOut,
  QrCode,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/labels';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    void logout();
    navigate('/login', { replace: true });
  }

  function goToAccountSecurity() {
    navigate('/account');
  }

  const nav = [
    { to: '/dashboard', label: 'Stock ledger', Icon: LayoutDashboard },
    ...(user?.role === 'national_supplier'
      ? [{ to: '/register', label: 'Register stock', Icon: PackagePlus }]
      : []),
    ...(['national_supplier', 'depot_manager', 'cooperative_official'].includes(user?.role)
      ? [{ to: '/movement', label: 'Stock movement', Icon: Truck }]
      : []),
    ...(user?.role === 'cooperative_official'
      ? [{ to: '/distribution', label: 'Cooperative issue', Icon: HandCoins }]
      : []),
    { to: '/recall', label: 'Alerts & recall', Icon: AlertTriangle },
    { to: '/reports', label: 'Reports', Icon: ClipboardList },
    { to: '/account', label: 'Account security', Icon: KeyRound },
    ...(user?.role === 'system_administrator'
      ? [{ to: '/users', label: 'User management', Icon: Users }]
      : []),
  ];

  const activeItem = nav.find((item) => location.pathname === item.to);
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;
  const mustChangePassword = Boolean(user?.must_change_password);
  const showPasswordPrompt = mustChangePassword && location.pathname !== '/account';

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-black/20 bg-forest text-white/90 md:flex">
        <div className="px-4 py-5">
          <div className="brand-tile rounded-lg border border-[#d9c6aa] p-3 text-forest shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-leaf shadow-sm">
                <Leaf size={19} className="text-forest" strokeWidth={2.5} />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#efe1cb] bg-wheat" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-base font-semibold text-white drop-shadow-sm">Mfuatano</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/55 drop-shadow-sm">
                  fertiliser traceability
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md bg-black/15 px-2.5 py-2 text-xs font-medium text-white/68">
              <ShieldCheck size={14} className="text-leaf" />
              Chain-of-custody workspace
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                  active
                    ? 'bg-white text-forest shadow-sm'
                    : 'text-white/70 hover:bg-pine hover:text-white'
                }`}
              >
                {active && <span className="absolute left-0 h-5 w-1 rounded-r bg-leaf" />}
                <Icon size={18} strokeWidth={2} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <SidebarRouteCard />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-moss text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="break-words text-[13px] font-medium leading-snug text-white">{user?.name}</div>
              <div className="truncate text-xs text-white/50">
                {roleLabel}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-pine hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen md:ml-64">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss">
                <Leaf size={19} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate font-display text-base font-semibold text-ink">Mfuatano</div>
                <div className="truncate text-xs text-mute">{roleLabel}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg border border-line bg-card p-2 text-mute transition-colors hover:text-ink"
            >
              <LogOut size={16} />
            </button>
          </div>
          <nav className="mobile-nav-scroll -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {nav.map(({ to, label, Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex h-9 max-w-[180px] shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium ${
                    active
                      ? 'border-moss bg-leaf-soft text-moss'
                      : 'border-line bg-card text-mute'
                  }`}
                >
                  <Icon size={15} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="hidden border-b border-line/80 bg-canvas/90 backdrop-blur md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-mute">
                Field operations console
              </div>
              <div className="font-display text-lg font-semibold text-ink">
                {activeItem?.label || 'Workspace'}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-leaf" />
              <span className="text-mute">Signed in as</span>
              <span className="font-medium text-ink">{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-moss">
                <KeyRound size={19} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-ink">
                  Change your password
                </h2>
                <p className="mt-2 text-sm leading-6 text-mute">
                  This is your first sign-in with an administrator-issued password. Update it in Account security before continuing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={goToAccountSecurity}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-moss px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest"
            >
              <KeyRound size={16} />
              Go to Account security
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarRouteCard() {
  return (
    <div className="sidebar-route-card rounded-lg border border-white/20 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
      <div className="flex min-h-20 items-end justify-between gap-2">
        <RouteNode Icon={Leaf} />
        <RouteNode Icon={Truck} />
        <RouteNode Icon={QrCode} />
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-[10px] font-semibold text-white">
        <PackageCheck size={13} />
        Supplier &rarr; Depot &rarr; Cooperative
      </div>
    </div>
  );
}

function RouteNode({ Icon }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-black/30 text-white/85 backdrop-blur-sm">
      <Icon size={15} />
    </div>
  );
}
