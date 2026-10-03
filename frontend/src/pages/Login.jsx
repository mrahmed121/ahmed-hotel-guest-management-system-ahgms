import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const from = location.state?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal-950 px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-charcoal-800 ring-1 ring-gold-500/40">
          <svg className="h-9 w-9 text-gold-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M12 10h.01M9 14h.01M15 14h.01M12 14h.01" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-wide text-slate-100">AHGMS</h1>
        <p className="mt-1 text-sm text-slate-400">Ahmed Hotel &amp; Guest Management System</p>
        <p className="mt-1 text-xs italic text-gold-500">Ahmed — Hospitality, Managed Smarter.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-charcoal-700 bg-charcoal-900 p-6 shadow-xl"
      >
        {error && (
          <div role="alert" className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          placeholder="you@hotel.com"
        />
        <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-5 w-full rounded-md border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          placeholder="••••••••"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-gold-500 px-4 py-2.5 font-semibold text-charcoal-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-xs text-slate-500">Developed by Ahmed</p>
    </div>
  );
}
