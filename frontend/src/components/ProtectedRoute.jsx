// Wraps pages that require a logged-in user. Optional role lists keep
// route-level permissions aligned with the backend.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  // While we check the stored token on first load, show nothing brief.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink/50">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
