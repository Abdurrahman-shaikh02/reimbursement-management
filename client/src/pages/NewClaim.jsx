import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Field, Input, Select } from '../components/ui.jsx';

// Type-specific fields: one set per subclass table
const DETAIL_FIELDS = {
  TRAVEL: [['travel_from', 'From'], ['travel_to', 'To'], ['distance_km', 'Distance (km)', 'number']],
  MEDICAL: [['hospital_name', 'Hospital'], ['treatment_type', 'Treatment']],
  BUSINESS: [['purpose', 'Purpose'], ['client_name', 'Client (optional)']],
};

const emptyItem = () => ({ category: '', description: '', amount: '', expense_date: '', receipt: null });

export default function NewClaim() {
  const { data: meta } = useLoad('/meta');
  const [type, setType] = useState('TRAVEL');
  const [details, setDetails] = useState({});
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const setItem = (i, field, value) => setItems(items.map((it, j) => (j === i ? { ...it, [field]: value } : it)));
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    // Multipart: the claim as JSON in "data", receipt i as file "receipt_i"
    const form = new FormData();
    form.append('data', JSON.stringify({
      claim_type: type,
      details,
      items: items.map(({ receipt, ...rest }) => rest), // eslint-disable-line no-unused-vars
    }));
    items.forEach((it, i) => it.receipt && form.append(`receipt_${i}`, it.receipt));
    try {
      const { reimbursement_id } = await api('/claims', { method: 'POST', form });
      navigate(`/claims/${reimbursement_id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card title="New claim">
        <ErrorBox error={error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Claim type">
            <Select value={type} onChange={(e) => { setType(e.target.value); setDetails({}); }}>
              {meta?.claimTypes.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          {DETAIL_FIELDS[type].map(([name, label, inputType = 'text']) => (
            <Field key={name} label={label}>
              <Input
                type={inputType}
                step="0.1"
                value={details[name] ?? ''}
                onChange={(e) => setDetails({ ...details, [name]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card
        title="Expense items"
        actions={<Button type="button" variant="secondary" onClick={() => setItems([...items, emptyItem()])}>Add item</Button>}
      >
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid items-end gap-2 border-b border-gray-100 pb-3 sm:grid-cols-[2rem_9rem_1fr_8rem_9rem_1fr_auto]">
              <span className="pb-2 text-sm text-gray-500">{i + 1}.</span>
              <Field label="Category">
                <Select value={it.category} onChange={(e) => setItem(i, 'category', e.target.value)}>
                  <option value="">—</option>
                  {meta?.categories.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Description"><Input value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} /></Field>
              <Field label="Amount (₹)"><Input type="number" step="0.01" value={it.amount} onChange={(e) => setItem(i, 'amount', e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={it.expense_date} onChange={(e) => setItem(i, 'expense_date', e.target.value)} /></Field>
              <Field label="Receipt (optional)">
                <input type="file" accept="image/*,application/pdf" className="text-sm" onChange={(e) => setItem(i, 'receipt', e.target.files[0] ?? null)} />
              </Field>
              <Button type="button" variant="secondary" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm">Total: <strong>{money(total)}</strong></span>
          <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit claim'}</Button>
        </div>
      </Card>
    </form>
  );
}
