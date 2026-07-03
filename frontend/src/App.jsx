// Router + top-level layout. Public route: /login. Everything else is
// wrapped in ProtectedRoute (needs a logged-in user) and AppShell (chrome).

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';

const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const RegisterStock = lazy(() => import('./pages/RegisterStock'));
const StockDetail = lazy(() => import('./pages/StockDetail'));
const Movement = lazy(() => import('./pages/Movement'));
const Recall = lazy(() => import('./pages/Recall'));
const UserAdmin = lazy(() => import('./pages/UserAdmin'));
const Reports = lazy(() => import('./pages/Reports'));
const Distribution = lazy(() => import('./pages/Distribution'));
const Account = lazy(() => import('./pages/Account'));

const SUPPLY_CHAIN_ROLES = ['national_supplier', 'depot_manager', 'cooperative_official'];

// Helper: a protected page rendered inside the app shell.
function Shell({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

function LazyPage({ children }) {
  return (
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm text-mute">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
          <Route path="/forgot-password" element={<LazyPage><ForgotPassword /></LazyPage>} />
          <Route path="/reset-password" element={<LazyPage><ResetPassword /></LazyPage>} />
          <Route path="/dashboard" element={<Shell><LazyPage><Dashboard /></LazyPage></Shell>} />
          <Route path="/register" element={<Shell roles={['national_supplier']}><LazyPage><RegisterStock /></LazyPage></Shell>} />
          <Route path="/movement" element={<Shell roles={SUPPLY_CHAIN_ROLES}><LazyPage><Movement /></LazyPage></Shell>} />
          <Route path="/distribution" element={<Shell roles={['cooperative_official']}><LazyPage><Distribution /></LazyPage></Shell>} />
          <Route path="/recall" element={<Shell><LazyPage><Recall /></LazyPage></Shell>} />
          <Route path="/reports" element={<Shell><LazyPage><Reports /></LazyPage></Shell>} />
          <Route path="/account" element={<Shell><LazyPage><Account /></LazyPage></Shell>} />
          <Route path="/users" element={<Shell roles={['system_administrator']}><LazyPage><UserAdmin /></LazyPage></Shell>} />
          <Route path="/stock/:id" element={<Shell><LazyPage><StockDetail /></LazyPage></Shell>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
