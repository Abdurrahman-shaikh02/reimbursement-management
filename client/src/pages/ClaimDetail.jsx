import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../useApi.js';
import { date, label, maskAccount, money } from '../format.js';
import {
  Button, Card, ErrorBanner, Field, Input, Loading, Notice, PageHeader, StatusBadge, Textarea,
} from '../components/ui.jsx';

function Info({ label: text, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{text}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  );
}

function TypeDetails({ claim }) {
  const d = claim.details;
  if (!d) return <p className="text-sm text-rose-700">Details missing.</p>;
  if (claim.claim_type === 'TRAVEL') {
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <Info label="From">{d.travel_from}</Info>
        <Info label="To">{d.travel_to}</Info>
        <Info label="Distance">{d.distance_km} km</Info>
      </dl>
    );
  }
  if (claim.claim_type === 'MEDICAL') {
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        <Info label="Hospital or clinic">{d.hospital_name}</Info>
        <Info label="Treatment">{label(d.treatment_type)}</Info>
      </dl>
    );
  }
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Info label="Purpose">{d.purpose}</Info>
      <Info label="Client">{d.client_name ?? 'Internal'}</Info>
    </dl>
  );
}

function Timeline({ claim }) {
  const steps = [
    { title: 'Submitted', done: true, text: `${claim.applicant_name} on ${date(claim.claim_date)}` },
    {
      title: claim.status === 'REJECTED' ? 'Rejected' : 'Approved',
      done: Boolean(claim.reviewed_by),
      tone: claim.status === 'REJECTED' ? 'bad' : 'good',
      text: claim.reviewed_by ? `${claim.reviewer_name} on ${date(claim.review_date)}` : 'Waiting for a manager',
      note: claim.remarks,
    },
  ];
  if (claim.status !== 'REJECTED') {
    steps.push({
      title: 'Paid',
      done: Boolean(claim.paid_by),
      tone: 'good',
      text: claim.paid_by ? `${claim.payer_name} on ${date(claim.payment_date)} · ref ${claim.payment_ref}` : 'Waiting for finance',
    });
  }
  return (
    <ol className="space-y-4">
      {steps.map((s) => (
        <li key={s.title} className="flex gap-3">
          <span
            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
              !s.done ? 'border-2 border-slate-300 bg-white' : s.tone === 'bad' ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <div>
            <p className={`text-sm font-medium ${s.done ? 'text-slate-900' : 'text-slate-500'}`}>{s.title}</p>
            <p className="text-xs text-slate-500">{s.text}</p>
            {s.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">“{s.note}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReviewPanel({ claim, user, onDone }) {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const overLimit = claim.total_amount > user.approval_limit;

  async function decide(decision) {
    setBusy(true);
    setError(null);
    try {
      await api(`/reviews/${claim.reimbursement_id}`, { method: 'POST', body: { decision, remarks } });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Card title="Your review">
      <ErrorBanner error={error} />
      {overLimit && (
        <Notice>
          This claim ({money(claim.total_amount)}) is above your approval limit of {money(user.approval_limit)}.
          The database will refuse your decision; a manager with a higher limit must review it.
        </Notice>
      )}
      <Field label="Remarks" hint="Required when rejecting; optional when approving">
        <Textarea maxLength={255} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <div className="mt-4 flex gap-2">
        <Button variant="success" disabled={busy} onClick={() => decide('APPROVED')}>Approve</Button>
        <Button variant="danger" disabled={busy} onClick={() => decide('REJECTED')}>Reject</Button>
      </div>
    </Card>
  );
}

function PaymentPanel({ claim, onDone }) {
  const [ref, setRef] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function pay(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/payments/${claim.reimbursement_id}`, { method: 'POST', body: { payment_ref: ref } });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Card title="Record payment">
      <ErrorBanner error={error} />
      <form onSubmit={pay} className="space-y-4">
        {claim.bank && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info label="Account number">{claim.bank.bank_account_no}</Info>
            <Info label="IFSC">{claim.bank.ifsc_code}</Info>
          </dl>
        )}
        <Field label="Bank transfer reference (UTR)">
          <Input required maxLength={30} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. UTR261026000123" />
        </Field>
        <Button type="submit" variant="success" disabled={busy}>Mark as paid · {money(claim.total_amount)}</Button>
      </form>
    </Card>
  );
}

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(`/claims/${id}`);
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBanner error={error} />;
  const { claim } = data;

  const isOwner = claim.applicant_id === user.employee_id;
  const canReview = user.roles.manager && !isOwner && claim.status === 'SUBMITTED';
  const canPay = user.roles.admin && !isOwner && claim.reviewed_by !== user.employee_id && claim.status === 'APPROVED';

  async function withdraw() {
    if (!window.confirm('Withdraw this claim? It will be deleted with all its items.')) return;
    try {
      await api(`/claims/${claim.reimbursement_id}`, { method: 'DELETE' });
      navigate('/claims');
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={`Claim #${claim.reimbursement_id}`}
        subtitle={`${label(claim.claim_type)} claim by ${claim.applicant_name}, ${claim.dept_name}`}
        actions={
          <>
            <StatusBadge status={claim.status} />
            {isOwner && claim.status === 'SUBMITTED' && (
              <Button variant="secondary" onClick={withdraw}>Withdraw</Button>
            )}
          </>
        }
      />
      <ErrorBanner error={actionError} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <dl className="grid gap-4 sm:grid-cols-4">
              <Info label="Claim date">{date(claim.claim_date)}</Info>
              <Info label="Type">{label(claim.claim_type)}</Info>
              <Info label="Items">{claim.item_count}</Info>
              <Info label="Total"><span className="font-semibold">{money(claim.total_amount)}</span></Info>
            </dl>
          </Card>

          <Card title={`${label(claim.claim_type)} details`}>
            <TypeDetails claim={claim} />
          </Card>

          <Card title="Expense items">
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {claim.items.map((item) => (
                    <tr key={item.item_no}>
                      <td className="px-5 py-3 text-slate-500">{item.item_no}</td>
                      <td className="px-5 py-3">{label(item.category)}</td>
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{date(item.expense_date)}</td>
                      <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">{money(item.amount)}</td>
                      <td className="px-5 py-3">
                        {item.receipt_path ? (
                          <a href={`/uploads/${item.receipt_path}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                            View
                          </a>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="px-5 py-3" colSpan={4}>Total</td>
                    <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">{money(claim.total_amount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Progress"><Timeline claim={claim} /></Card>
          {canReview && <ReviewPanel claim={claim} user={user} onDone={reload} />}
          {canPay && <PaymentPanel claim={claim} onDone={reload} />}
          {claim.bank && !canPay && (
            <Card title="Payout account">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info label="Account">{maskAccount(claim.bank.bank_account_no)}</Info>
                <Info label="IFSC">{claim.bank.ifsc_code}</Info>
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
