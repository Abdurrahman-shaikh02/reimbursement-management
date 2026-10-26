import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Button, ErrorBanner, Field, Input } from '../components/ui.jsx';

// Seed accounts (db/05_seed.sql); every password is password123.
const DEMO_ACCOUNTS = [
  { email: 'vikram.singh@rms.example', who: 'Vikram', role: 'Applicant' },
  { email: 'neha.joshi@rms.example', who: 'Neha', role: 'Applicant + manager (limit ₹10k)' },
  { email: 'rahul.mehta@rms.example', who: 'Rahul', role: 'Applicant + manager (limit ₹50k)' },
  { email: 'priya.kulkarni@rms.example', who: 'Priya', role: 'Applicant + manager (limit ₹75k)' },
  { email: 'sneha.patil@rms.example', who: 'Sneha', role: 'Applicant + admin' },
  { email: 'meera.shah@rms.example', who: 'Meera', role: 'Admin only' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">₹</span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Reimbursement Management System</h1>
            <p className="text-sm text-slate-500">Sign in to file, review and pay expense claims</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorBanner error={error} />
          <Field label="Email">
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Demo accounts · password <span className="font-mono normal-case">password123</span>
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword('password123');
                }}
                className="rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                <span className="font-medium text-slate-900">{a.who}</span>
                <span className="block text-xs text-slate-500">{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
