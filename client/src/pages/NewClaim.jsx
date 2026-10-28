import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate, humanize, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { validateClaim } from '../../../shared/validation.mjs';
import Icon from '../components/Icon.jsx';
import {
  Button,
  ButtonLink,
  Card,
  ErrorBox,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
} from '../components/ui.jsx';

// Type-specific fields: one set per subclass table
const DETAIL_FIELDS = {
  TRAVEL: [
    ['travel_from', 'From'],
    ['travel_to', 'To'],
    ['distance_km', 'Distance (km)', 'number'],
  ],
  MEDICAL: [
    ['hospital_name', 'Hospital'],
    ['treatment_type', 'Treatment'],
  ],
  BUSINESS: [
    ['purpose', 'Purpose'],
    ['client_name', 'Client (optional)'],
  ],
};

const emptyItem = () => ({ category: '', description: '', amount: '', expense_date: '', receipt: null });

export default function NewClaim() {
  const { data: meta, error: loadError } = useLoad('/meta');
  const [type, setType] = useState('TRAVEL');
  const [details, setDetails] = useState({});
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const setItem = (i, field, value) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [field]: value } : it)));

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateClaim({ claim_type: type, details, items }, meta?.claimDate);
    if (validationError) return setError(validationError);
    setSaving(true);
    // Multipart: the claim as JSON in "data", receipt i as file "receipt_i"
    const form = new FormData();
    form.append(
      'data',
      JSON.stringify({
        claim_type: type,
        details,
        items: items.map(({ receipt, ...rest }) => rest), // eslint-disable-line no-unused-vars
      }),
    );
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
    <>
      <PageHeader
        eyebrow="PERSONAL EXPENSES"
        title="Create a claim"
        description="Add the details. Attach your receipts. We'll take it from here."
        actions={
          <ButtonLink to="/claims" variant="secondary">
            <Icon name="back" size={16} />
            My claims
          </ButtonLink>
        }
      />
      <ErrorBox error={loadError || error} />
      <form onSubmit={submit} className="form-layout">
        <div>
          <Card title="01 / Claim details" description="Choose the kind of expense you're claiming">
            <div className="form-grid">
              <Field label="Claim type">
                <Select
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setDetails({});
                  }}
                >
                  {(meta?.claimTypes ?? ['TRAVEL', 'MEDICAL', 'BUSINESS']).map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Claim date" hint="The date is set when you submit.">
                <Input value={meta ? formatDate(meta.claimDate) : 'Loading...'} readOnly />
              </Field>
              {DETAIL_FIELDS[type].map(([name, label, inputType = 'text']) => (
                <Field key={name} label={label}>
                  <Input
                    type={inputType}
                    step="0.1"
                    min={inputType === 'number' ? '0.1' : undefined}
                    max={inputType === 'number' ? '999999.9' : undefined}
                    maxLength={name === 'treatment_type' ? 60 : name === 'purpose' ? 200 : 100}
                    required={name !== 'client_name'}
                    placeholder={inputType === 'number' ? '0.0' : label}
                    value={details[name] ?? ''}
                    onChange={(event) => setDetails({ ...details, [name]: event.target.value })}
                  />
                </Field>
              ))}
            </div>
          </Card>
          <Card
            title="02 / Expense items"
            description="Break down your expenses and add supporting receipts"
            actions={
              <Button variant="secondary" onClick={() => setItems([...items, emptyItem()])}>
                <Icon name="plus" size={16} />
                Add item
              </Button>
            }
          >
            {items.map((item, index) => (
              <div key={index} className="expense-item">
                <div className="expense-item-header">
                  <span>
                    <Icon name="receipt" size={16} />
                    Expense {String(index + 1).padStart(2, '0')}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove expense ${index + 1}`}
                  >
                    <Icon name="trash" size={14} />
                    Remove
                  </Button>
                </div>
                <div className="expense-item-body">
                  <Field label="Category">
                    <Select
                      required
                      value={item.category}
                      onChange={(event) => setItem(index, 'category', event.target.value)}
                    >
                      <option value="">Choose a category</option>
                      {meta?.categories.map((category) => (
                        <option key={category} value={category}>
                          {humanize(category)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Amount (INR)">
                    <Input
                      required
                      type="number"
                      min="0.01"
                      max="99999999.99"
                      step="0.01"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={(event) => setItem(index, 'amount', event.target.value)}
                    />
                  </Field>
                  <Field label="Description">
                    <Input
                      required
                      maxLength={200}
                      placeholder="What was this expense for?"
                      value={item.description}
                      onChange={(event) => setItem(index, 'description', event.target.value)}
                    />
                  </Field>
                  <Field label="Expense date">
                    <Input
                      required
                      type="date"
                      max={meta?.claimDate}
                      value={item.expense_date}
                      onChange={(event) => setItem(index, 'expense_date', event.target.value)}
                    />
                  </Field>
                  <div className="wide-field">
                    <Field label="Receipt (optional)" hint="Upload an image or PDF, up to 5 MB.">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="file-input"
                        onChange={(event) => setItem(index, 'receipt', event.target.files[0] ?? null)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <aside className="form-aside">
          <Card title="Claim summary">
            <div className="summary-line">
              <span>Claim type</span>
              <strong>{humanize(type)}</strong>
            </div>
            <div className="summary-line">
              <span>Expense items</span>
              <strong>{items.length}</strong>
            </div>
            <div className="summary-line">
              <span>Receipts attached</span>
              <strong>{items.filter((item) => item.receipt).length}</strong>
            </div>
            <div className="summary-total">
              <span>Total claim</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="form-actions">
              <Button type="submit" className="w-full" disabled={saving || !meta}>
                {saving ? 'Submitting...' : 'Submit claim'}
                <Icon name="arrow" size={16} />
              </Button>
            </div>
            <p className="form-note">
              Check your details before submitting. Saved claims and expense items cannot be edited.
            </p>
          </Card>
          <Notice>Expense dates must be on or before your claim date.</Notice>
        </aside>
      </form>
    </>
  );
}
