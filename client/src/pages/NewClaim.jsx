import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { label, money, today } from '../format.js';
import { Button, Card, ErrorBanner, Field, Input, Loading, PageHeader, Select } from '../components/ui.jsx';

const TYPE_HELP = {
  TRAVEL: 'Trips for work: fares, lodging, fuel and meals on the way.',
  MEDICAL: 'Treatment costs covered by the company medical policy.',
  BUSINESS: 'Client meetings, events and other business expenses.',
};

const EMPTY_DETAILS = {
  TRAVEL: { travel_from: '', travel_to: '', distance_km: '' },
  MEDICAL: { hospital_name: '', treatment_type: 'CONSULTATION' },
  BUSINESS: { purpose: '', client_name: '' },
};

function newItem() {
  return { category: 'FARE', description: '', amount: '', expense_date: today(), receipt: null };
}

export default function NewClaim() {
  const navigate = useNavigate();
  const meta = useApi('/meta');
  const [type, setType] = useState('TRAVEL');
  const [details, setDetails] = useState(EMPTY_DETAILS.TRAVEL);
  const [items, setItems] = useState([newItem()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (meta.loading) return <Loading />;
  if (meta.error) return <ErrorBanner error={meta.error} />;
  const { categories, treatmentTypes } = meta.data;

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const setDetail = (key) => (e) => setDetails({ ...details, [key]: e.target.value });
  const setItem = (index, key, value) => setItems(items.map((it, i) => (i === index ? { ...it, [key]: value } : it)));

  function chooseType(t) {
    setType(t);
    setDetails(EMPTY_DETAILS[t]);
  }

  // One multipart request: the claim as JSON plus one optional receipt file
  // per item. The server writes everything in a single transaction.
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('data', JSON.stringify({
      claim_type: type,
      details,
      items: items.map(({ receipt, ...item }) => ({ ...item, amount: Number(item.amount) })),
    }));
    items.forEach((item, i) => item.receipt && form.append(`receipt_${i}`, item.receipt));
    try {
      const { claim } = await api('/claims', { method: 'POST', form });
      navigate(`/claims/${claim.reimbursement_id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="New claim" subtitle="You can withdraw a claim until a manager reviews it" />
      <ErrorBanner error={error} />

      <div className="space-y-6">
        <Card title="1 · Claim type">
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.keys(TYPE_HELP).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => chooseType(t)}
                className={`rounded-lg border p-4 text-left ${
                  type === t ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-medium text-slate-900">{label(t)}</span>
                <span className="mt-1 block text-xs text-slate-500">{TYPE_HELP[t]}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={`2 · ${label(type)} details`}>
          {type === 'TRAVEL' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="From"><Input required maxLength={60} value={details.travel_from} onChange={setDetail('travel_from')} /></Field>
              <Field label="To"><Input required maxLength={60} value={details.travel_to} onChange={setDetail('travel_to')} /></Field>
              <Field label="Distance (km)" hint="Distance actually travelled on this trip">
                <Input required type="number" min="0.1" step="0.1" value={details.distance_km} onChange={setDetail('distance_km')} />
              </Field>
            </div>
          )}
          {type === 'MEDICAL' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hospital or clinic"><Input required maxLength={100} value={details.hospital_name} onChange={setDetail('hospital_name')} /></Field>
              <Field label="Treatment type">
                <Select value={details.treatment_type} onChange={setDetail('treatment_type')}>
                  {treatmentTypes.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                </Select>
              </Field>
            </div>
          )}
          {type === 'BUSINESS' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purpose"><Input required maxLength={200} value={details.purpose} onChange={setDetail('purpose')} /></Field>
              <Field label="Client" hint="Leave empty for internal business">
                <Input maxLength={100} value={details.client_name} onChange={setDetail('client_name')} />
              </Field>
            </div>
          )}
        </Card>

        <Card
          title="3 · Expense items"
          actions={<Button variant="secondary" onClick={() => setItems([...items, newItem()])}>Add item</Button>}
        >
          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">Item {i + 1}</span>
                  {items.length > 1 && (
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Category">
                    <Select value={item.category} onChange={(e) => setItem(i, 'category', e.target.value)}>
                      {categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Description" className="lg:col-span-2">
                    <Input required maxLength={200} value={item.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  </Field>
                  <Field label="Date">
                    <Input required type="date" max={today()} value={item.expense_date} onChange={(e) => setItem(i, 'expense_date', e.target.value)} />
                  </Field>
                  <Field label="Amount (₹)">
                    <Input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(e) => setItem(i, 'amount', e.target.value)} />
                  </Field>
                </div>
                <Field label="Receipt (optional)" hint="JPG, PNG, WebP or PDF, up to 5 MB" className="mt-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setItem(i, 'receipt', e.target.files[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Total <span className="ml-2 text-xl font-semibold tabular-nums text-slate-900">{money(total)}</span>
            <span className="ml-2 text-xs text-slate-500">computed from the items, never stored</span>
          </p>
          <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim'}</Button>
        </div>
      </div>
    </form>
  );
}
