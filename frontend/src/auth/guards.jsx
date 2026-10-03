import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Spinner from '../components/Spinner';

export function RequireAuth({ children }) {
  const { isAuthenticated, loading, initialized } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export function RequirePermission({ permission, children }) {
  const { hasPermission, initialized, loading } = useAuth();

  if (!initialized || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Forbidden />;
  }

  return children;
}

export function Forbidden() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-gold-500">403</p>
      <h1 className="mt-2 text-lg font-semibold text-slate-200">Access denied</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        You don&apos;t have permission to view this page. Contact your hotel administrator if you
        believe this is a mistake.
      </p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-gold-500">404</p>
      <h1 className="mt-2 text-lg font-semibold text-slate-200">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        The page you&apos;re looking for doesn&apos;t exist in AHGMS.
      </p>
    </div>
  );
}
