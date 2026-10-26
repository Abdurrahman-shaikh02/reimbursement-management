import { useState } from 'react';
import { useApi } from '../useApi.js';
import { label, money } from '../format.js';
import { Card, ErrorBanner, Loading, PageHeader, StatCard, StatusBadge } from '../components/ui.jsx';

// Two categorical slots from the reference palette, validated together
// (CVD and normal-vision separation, 3:1 contrast on white).
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// One measure across a handful of items: a horizontal bar list, single hue,
// values printed beside the bars, so no legend is needed.
function BarList({ rows, nameKey, format = label }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r[nameKey]} className="group" title={`${format(r[nameKey])}: ${money(r.amount)} (${r.claims ?? r.items} ${r.claims != null ? 'claims' : 'items'})`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="text-slate-700">{format(r[nameKey])}</span>
            <span className="font-medium tabular-nums text-slate-900">{money(r.amount)}</span>
          </div>
          <div className="h-2.5 rounded-r bg-slate-100">
            <div
              className="h-2.5 rounded-r transition-opacity group-hover:opacity-80"
              style={{ width: `${(r.amount / max) * 100}%`, background: SERIES_1 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Paid + approved-but-unpaid = approved spend, so the two stack into a whole.
function MonthlyChart({ rows }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...rows.map((r) => r.approved_amount), 1);
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];

  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_1 }} />Paid</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_2 }} />Approved, not yet paid</span>
      </div>
      <div className="relative flex h-56 gap-2 pl-12">
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute left-12 right-0 border-t border-slate-100" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute -left-12 -top-2 w-10 text-right text-[11px] text-slate-500">{compact.format(t)}</span>
          </div>
        ))}
        {rows.map((r) => {
          const unpaid = r.approved_amount - r.paid_amount;
          return (
            <div
              key={r.month}
              className="relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(r.month)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === r.month && (
                <div className="absolute bottom-full z-10 mb-2 w-44 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
                  <p className="font-medium text-slate-900">{monthName(r.month)}</p>
                  <p className="mt-1 flex justify-between text-slate-600"><span>Paid</span><span className="tabular-nums">{money(r.paid_amount)}</span></p>
                  <p className="flex justify-between text-slate-600"><span>Not yet paid</span><span className="tabular-nums">{money(unpaid)}</span></p>
                  <p className="mt-1 text-slate-500">{r.claims} claims filed</p>
                </div>
              )}
              <div className="flex w-full max-w-12 flex-col gap-[2px]" style={{ height: `${(r.approved_amount / top) * 100}%` }}>
                {unpaid > 0 && <div className="rounded-t" style={{ flex: unpaid, background: SERIES_2 }} />}
                {r.paid_amount > 0 && <div className={unpaid > 0 ? '' : 'rounded-t'} style={{ flex: r.paid_amount, background: SERIES_1 }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 pl-12">
        {rows.map((r) => (
          <span key={r.month} className="flex-1 text-center text-xs text-slate-500">{MONTHS[Number(r.month.slice(5, 7)) - 1]}</span>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  const { data, error, loading } = useApi('/reports');
  if (loading) return <Loading />;
  if (error) return <ErrorBanner error={error} />;

  const status = (s) => data.byStatus.find((r) => r.status === s) ?? { claims: 0, amount: 0 };
  const approvedSpend = status('APPROVED').amount + status('PAID').amount;

  return (
    <>
      <PageHeader title="Reports" subtitle="Approved spend counts claims that are approved or already paid" />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Approved spend" value={money(approvedSpend)} sub={`${status('APPROVED').claims + status('PAID').claims} claims`} />
          <StatCard label="Paid out" value={money(status('PAID').amount)} sub={`${status('PAID').claims} claims`} />
          <StatCard label="Approved, awaiting payment" value={money(status('APPROVED').amount)} sub={`${status('APPROVED').claims} claims`} />
          <StatCard label="Waiting for review" value={money(status('SUBMITTED').amount)} sub={`${status('SUBMITTED').claims} claims`} />
        </div>

        <Card title="Approved spend by month of claim">
          <MonthlyChart rows={data.byMonth} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="By department"><BarList rows={data.byDepartment} nameKey="dept_name" format={(x) => x} /></Card>
          <Card title="By claim type"><BarList rows={data.byType} nameKey="claim_type" /></Card>
          <Card title="By expense category"><BarList rows={data.byCategory} nameKey="category" /></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Top claimants (RANK window function)">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Rank</th><th className="pb-2">Employee</th><th className="pb-2 text-right">Claims</th><th className="pb-2 text-right">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topClaimants.map((r) => (
                  <tr key={r.applicant_name}>
                    <td className="py-2 text-slate-500">{r.spend_rank}</td>
                    <td className="py-2"><div className="text-slate-900">{r.applicant_name}</div><div className="text-xs text-slate-500">{r.dept_name}</div></td>
                    <td className="py-2 text-right">{r.claims}</td>
                    <td className="py-2 text-right tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Claims by status">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Status</th><th className="pb-2 text-right">Claims</th><th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byStatus.map((r) => (
                  <tr key={r.status}>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                    <td className="py-2 text-right">{r.claims}</td>
                    <td className="py-2 text-right tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title="Reporting hierarchy (recursive query over SUPERVISES)">
          <ul className="space-y-1 text-sm">
            {data.hierarchy.map((e) => (
              <li key={e.employee_id} style={{ paddingLeft: `${e.level * 1.5}rem` }} className="flex items-baseline gap-2">
                {e.level > 0 && <span className="text-slate-300">└</span>}
                <span className="text-slate-900">{e.name}</span>
                <span className="text-xs text-slate-500">{e.designation}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
