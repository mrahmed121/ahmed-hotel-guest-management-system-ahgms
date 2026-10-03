import { useAuth } from '../auth/AuthContext';

/**
 * Renders children only when the user has the required permission(s).
 * Otherwise renders nothing (or the provided fallback).
 */
export default function PermissionGuard({ permission, fallback = null, children }) {
  const { hasPermission, initialized } = useAuth();
  if (!initialized) return null;
  if (!hasPermission(permission)) return fallback;
  return <>{children}</>;
}
