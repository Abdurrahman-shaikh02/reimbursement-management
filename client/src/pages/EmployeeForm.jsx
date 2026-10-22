import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Field, Input, Select } from '../components/ui.jsx';

const EMPTY = {
  name: '', email: '', password: '', designation: '', date_of_joining: '', dept_id: '', supervisor_id: '',
  phones: '', bank_account_no: '', approval_limit: '',
};

// Add or edit an employee, their phone numbers and their roles
export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: departments } = useLoad('/admin/departments');
  const { data: employees } = useLoad('/admin/employees');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api(`/admin/employees/${id}`)
      .then((e) => setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ''])),
        phones: e.phones.join(', '),
        password: '',
      }))
      .catch((err) => setError(err.message));
  }, [id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const body = { ...form, phones: form.phones.split(',') };
    try {
      await (id
        ? api(`/admin/employees/${id}`, { method: 'PUT', body })
        : api('/admin/employees', { method: 'POST', body }));
      navigate('/employees');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={save}>
      <Card title={id ? 'Edit employee' : 'Add employee'}>
        <ErrorBox error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label={id ? 'New password (leave empty to keep)' : 'Password'}><Input type="password" value={form.password} onChange={set('password')} /></Field>
          <Field label="Designation"><Input value={form.designation} onChange={set('designation')} /></Field>
          <Field label="Date of joining"><Input type="date" value={form.date_of_joining} onChange={set('date_of_joining')} /></Field>
          <Field label="Department">
            <Select value={form.dept_id} onChange={set('dept_id')}>
              <option value="">—</option>
              {departments?.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </Select>
          </Field>
          <Field label="Supervisor">
            <Select value={form.supervisor_id} onChange={set('supervisor_id')}>
              <option value="">None (top of the hierarchy)</option>
              {employees?.filter((e) => String(e.employee_id) !== id)
                .map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Phone numbers (comma-separated)"><Input value={form.phones} onChange={set('phones')} /></Field>
        </div>
      </Card>
      <Card title="Roles">
        <p className="mb-3 text-sm text-gray-600">Fill in a field to give the role; leave it empty to remove it. An employee can have both roles, or neither.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Applicant — bank account number"><Input value={form.bank_account_no} onChange={set('bank_account_no')} /></Field>
          <Field label="Manager — approval limit (₹)"><Input type="number" step="0.01" value={form.approval_limit} onChange={set('approval_limit')} /></Field>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/employees')}>Cancel</Button>
      </div>
    </form>
  );
}
