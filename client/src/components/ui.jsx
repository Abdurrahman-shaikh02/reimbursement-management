import { Link } from 'react-router';
import { date, label, money } from '../format.js';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const BUTTON = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${BUTTON[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({ variant = 'primary', className = '', ...props }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${BUTTON[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label: text, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100';

export function Input(props) {
  return <input className={CONTROL} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={CONTROL} {...props}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return <textarea className={CONTROL} rows={3} {...props} />;
}

const STATUS_STYLE = {
  SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-sky-50 text-sky-800 ring-sky-200',
  REJECTED: 'bg-rose-50 text-rose-800 ring-rose-200',
  PAID: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {label(status)}
    </span>
  );
}

export function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    violet: 'bg-violet-50 text-violet-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {error.message ?? String(error)}
    </div>
  );
}

export function Notice({ children }) {
  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{children}</div>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>;
}

export function Empty({ children }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function StatCard({ label: text, value, sub, to }) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200">
      <p className="text-sm text-slate-500">{text}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// Table of claims from reimbursement_summary rows. Rows link to the claim.
export function ClaimsTable({ claims, showApplicant = false, extra }) {
  if (claims.length === 0) return <Empty>No claims here.</Empty>;
  return (
    <div className="-mx-5 -my-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Claim</th>
            {showApplicant && <th className="px-5 py-3">Applicant</th>}
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Claim date</th>
            <th className="px-5 py-3 text-right">Items</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3">Status</th>
            {extra && <th className="px-5 py-3">{extra.header}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {claims.map((c) => (
            <tr key={c.reimbursement_id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium">
                <Link to={`/claims/${c.reimbursement_id}`} className="text-indigo-600 hover:underline">
                  #{c.reimbursement_id}
                </Link>
              </td>
              {showApplicant && (
                <td className="px-5 py-3">
                  <div className="text-slate-900">{c.applicant_name}</div>
                  <div className="text-xs text-slate-500">{c.dept_name}</div>
                </td>
              )}
              <td className="px-5 py-3">{label(c.claim_type)}</td>
              <td className="px-5 py-3 whitespace-nowrap">{date(c.claim_date)}</td>
              <td className="px-5 py-3 text-right">{c.item_count}</td>
              <td className="px-5 py-3 text-right font-medium tabular-nums whitespace-nowrap">{money(c.total_amount)}</td>
              <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
              {extra && <td className="px-5 py-3">{extra.cell(c)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`rounded-md px-3 py-1.5 font-medium ${
            value === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
