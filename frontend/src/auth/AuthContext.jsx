import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

function extractUser(payload) {
  // Login:  { data: { token, user } }
  // me():   { data: <user> }  (user object directly under data)
  const data = payload?.data ?? payload ?? {};
  if (data.user) return data.user;
  return data.id ? data : null;
}

function extractPermissions(user) {
  if (!user) return [];
  // Backend nests permissions on the singular role: user.role.permissions.
  // Fall back to a top-level user.permissions array if a future API provides it.
  const perms = user.permissions ?? user.role?.permissions;
  if (Array.isArray(perms)) {
    return perms.map((p) => (typeof p === 'string' ? p : p.slug ?? p.name)).filter(Boolean);
  }
  return [];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const applyUser = useCallback((nextUser) => {
    setUser(nextUser);
    setPermissions(extractPermissions(nextUser));
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const payload = await authApi.me();
      applyUser(extractUser(payload));
    } catch {
      setToken(null);
      applyUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [applyUser]);

  useEffect(() => {
    if (getToken()) {
      fetchMe();
    } else {
      setLoading(false);
      setInitialized(true);
    }
  }, [fetchMe]);

  const login = useCallback(
    async (email, password) => {
      const payload = await authApi.login(email, password);
      const data = payload?.data ?? {};
      if (!data.token) throw new Error('Login failed: no token returned.');
      setToken(data.token);
      applyUser(data.user ?? extractUser(await authApi.me().catch(() => null)));
      return data.user;
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Token may already be invalid; still clear local state.
    } finally {
      setToken(null);
      applyUser(null);
    }
  }, [applyUser]);

  const hasPermission = useCallback(
    (slug) => {
      if (!slug) return true;
      if (Array.isArray(slug)) return slug.every((s) => permissions.includes(s));
      return permissions.includes(slug);
    },
    [permissions]
  );

  const value = useMemo(
    () => ({
      user,
      permissions,
      loading,
      initialized,
      isAuthenticated: !!user,
      login,
      logout,
      hasPermission,
      refresh: fetchMe,
    }),
    [user, permissions, loading, initialized, login, logout, hasPermission, fetchMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
