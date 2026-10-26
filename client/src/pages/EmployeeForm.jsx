import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Button, Card, ErrorBanner, Field, Input, Loading, PageHeader, Select } from '../components/ui.jsx';

const BLANK = {
  name: '', email: '', designation: '', date_of_joining: '', dept_id: '', supervisor_id: '', password: '',
  phones: [''],
  is_applicant: false, bank_account_no: '', ifsc_code: '',
  is_manager: false, approval_limit: '',
  is_admin: false,
};

export default function EmployeeForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const meta = useApi('/meta');
  const [form, setForm] = useState(isNew ? BLANK : null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api(`/admin/employees/${id}`)
      .then(({ employee: e }) =>
        setForm({
          ...BLANK,
          ...e,
          dept_id: e.dept_id ?? '',
          supervisor_id: e.supervisor_id ?? '',
          bank_account_no: e.bank_account_no ?? '',
          ifsc_code: e.ifsc_code ?? '',
          approval_limit: e.approval_limit ?? '',
          is_applicant: Boolean(e.is_applicant),
          is_manager: Boolean(e.is_manager),
          is_admin: Boolean(e.is_admin),
          phones: e.phones.length ? e.phones : [''],
          password: '',
        }),
      )
      .catch(setError);
  }, [id, isNew]);

  if (meta.loading || (!form && !error)) return <Loading />;
  if (!form) return <ErrorBanner error={error} />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setPhone = (i, value) => setForm({ ...form, phones: form.phones.map((p, j) => (j === i ? value : p)) });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      dept_id: Number(form.dept_id),
      supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
      approval_limit: form.approval_limit === '' ? null : Number(form.approval_limit),
    };
    try {
      if (isNew) await api('/admin/employees', { method: 'POST', body });
      else await api(`/admin/employees/${id}`, { method: 'PUT', body });
      navigate('/admin/employees');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form.name}? This only works if they have no history.`)) return;
    try {
      await api(`/admin/employees/${id}`, { method: 'DELETE' });
      navigate('/admin/employees');
    } catch (err) {
      setError(err);
    }
  }

  const supervisors = meta.data.employees.filter((e) => String(e.employee_id) !== String(id));

  return (
    <form onSubmit={save}>
      <PageHeader
        title={isNew ? 'Add employee' : `Edit ${form.name}`}
        actions={!isNew && <Button variant="secondary" onClick={remove}>Delete</Button>}
      />
      <ErrorBanner error={error} />

      <div className="space-y-6">
        <Card title="Employee">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input required maxLength={100} value={form.name} onChange={set('name')} /></Field>
            <Field label="Email" hint="Used to sign in; must be unique"><Input required type="email" maxLength={100} value={form.email} onChange={set('email')} /></Field>
            <Field label="Designation"><Input required maxLength={60} value={form.designation} onChange={set('designation')} /></Field>
            <Field label="Date of joining"><Input required type="date" value={form.date_of_joining} onChange={set('date_of_joining')} /></Field>
            <Field label="Department (works in)">
              <Select required value={form.dept_id} onChange={set('dept_id')}>
                <option value="">Choose…</option>
                {meta.data.departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
              </Select>
            </Field>
            <Field label="Supervisor" hint="Leave empty for the head of the organisation">
              <Select value={form.supervisor_id} onChange={set('supervisor_id')}>
                <option value="">None</option>
                {supervisors.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
              </Select>
            </Field>
            <Field label={isNew ? 'Initial password' : 'New password'} hint={isNew ? 'At least 8 characters' : 'Leave empty to keep the current password'}>
              <Input type="password" required={isNew} minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
            </Field>
          </div>
        </Card>

        <Card
          title="Phone numbers (multivalued)"
          actions={<Button variant="secondary" onClick={() => setForm({ ...form, phones: [...form.phones, ''] })}>Add phone</Button>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {form.phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input value={p} placeholder="+919822000000" onChange={(e) => setPhone(i, e.target.value)} />
                <Button variant="ghost" onClick={() => setForm({ ...form, phones: form.phones.filter((_, j) => j !== i) })}>Remove</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Roles (overlapping specialization)">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input type="checkbox" checked={form.is_applicant} onChange={set('is_applicant')} /> Applicant
              </label>
              <p className="mb-3 mt-1 text-xs text-slate-500">Can submit claims; needs a payout account.</p>
              {form.is_applicant && (
                <div className="space-y-3">
                  <Field label="Bank account number"><Input required value={form.bank_account_no} onChange={set('bank_account_no')} /></Field>
                  <Field label="IFSC code"><Input required maxLength={11} value={form.ifsc_code} onChange={set('ifsc_code')} /></Field>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input type="checkbox" checked={form.is_manager} onChange={set('is_manager')} /> Manager
              </label>
              <p className="mb-3 mt-1 text-xs text-slate-500">Can review claims up to an approval limit.</p>
              {form.is_manager && (
                <Field label="Approval limit (₹)">
                  <Input required type="number" min="1" step="0.01" value={form.approval_limit} onChange={set('approval_limit')} />
                </Field>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input type="checkbox" checked={form.is_admin} onChange={set('is_admin')} /> Admin
              </label>
              <p className="mt-1 text-xs text-slate-500">Pays approved claims and manages employees and departments.</p>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate('/admin/employees')}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save employee'}</Button>
        </div>
      </div>
    </form>
  );
}
