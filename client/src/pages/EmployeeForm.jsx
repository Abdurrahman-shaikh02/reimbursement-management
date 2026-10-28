import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../useLoad.js';
import { validateSupervisor } from '../../../shared/validation.mjs';
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

const EMPTY = {
  name: '',
  email: '',
  password: '',
  designation: '',
  date_of_joining: '',
  dept_id: '',
  supervisor_id: '',
  phones: '',
  bank_account_no: '',
  approval_limit: '',
};

// Add or edit an employee, their phone numbers and their roles
export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: departments } = useLoad('/admin/departments');
  const { data: employees, error: employeesError } = useLoad('/admin/employees');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(!id);

  useEffect(() => {
    if (!id) {
      setProfileLoaded(true);
      return;
    }
    setProfileLoaded(false);
    api(`/admin/employees/${id}`)
      .then((e) =>
        setForm({
          ...EMPTY,
          ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ''])),
          phones: e.phones.join(', '),
          password: '',
        }),
      )
      .then(() => setProfileLoaded(true))
      .catch((err) => setError(err.message));
  }, [id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!employees) return setError('Wait for the employee directory to load.');
    const validationError = validateSupervisor(id, form.supervisor_id, employees);
    if (validationError) return setError(validationError);
    setSaving(true);
    const body = { ...form, phones: form.phones.split(',') };
    try {
      await (id
        ? api(`/admin/employees/${id}`, { method: 'PUT', body })
        : api('/admin/employees', { method: 'POST', body }));
      navigate('/employees');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="YOUR ORGANIZATION"
        title={id ? 'Edit employee' : 'Add a team member'}
        description={
          id
            ? 'Keep profile details and permissions up to date.'
            : 'Create a profile and give your teammate the access they need.'
        }
        actions={
          <ButtonLink to="/employees" variant="secondary">
            <Icon name="back" size={16} />
            Directory
          </ButtonLink>
        }
      />
      <ErrorBox error={employeesError || error} />
      <form onSubmit={save} className="form-layout">
        <div>
          <Card title="01 / Personal & work details" description="The basics for this employee's profile">
            <fieldset disabled={!profileLoaded || saving} className="form-grid">
              <Field label="Full name">
                <Input
                  required
                  maxLength={80}
                  placeholder="e.g. Anita Deshmukh"
                  value={form.name}
                  onChange={set('name')}
                />
              </Field>
              <Field label="Work email">
                <Input
                  required
                  maxLength={100}
                  type="email"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={set('email')}
                />
              </Field>
              <Field
                label={id ? 'New password' : 'Password'}
                hint={id ? 'Leave empty to keep the current password.' : 'Used to sign in to the workspace.'}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  required={!id}
                  value={form.password}
                  onChange={set('password')}
                />
              </Field>
              <Field label="Designation">
                <Input
                  required
                  maxLength={50}
                  placeholder="e.g. Software Engineer"
                  value={form.designation}
                  onChange={set('designation')}
                />
              </Field>
              <Field label="Date of joining">
                <Input required type="date" value={form.date_of_joining} onChange={set('date_of_joining')} />
              </Field>
              <Field label="Department">
                <Select required value={form.dept_id} onChange={set('dept_id')}>
                  <option value="">Choose a department</option>
                  {departments?.map((department) => (
                    <option key={department.dept_id} value={department.dept_id}>
                      {department.dept_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reports to">
                <Select value={form.supervisor_id} onChange={set('supervisor_id')}>
                  <option value="">None (top of hierarchy)</option>
                  {employees?.map((person) => (
                    <option
                      key={person.employee_id}
                      value={person.employee_id}
                      disabled={!!validateSupervisor(id, person.employee_id, employees)}
                    >
                      {person.name}
                      {validateSupervisor(id, person.employee_id, employees) ? ' (would create a cycle)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone numbers" hint="Separate multiple numbers with commas.">
                <Input placeholder="+919800000001" value={form.phones} onChange={set('phones')} />
              </Field>
            </fieldset>
          </Card>
          <Card
            title="02 / Roles & permissions"
            description="An employee can be an applicant, a manager, both, or neither"
          >
            <div className="form-grid">
              <Field
                label="Applicant / bank account number"
                hint="Fill this in to allow expense submissions."
              >
                <Input
                  maxLength={18}
                  inputMode="numeric"
                  placeholder="Bank account number"
                  value={form.bank_account_no}
                  onChange={set('bank_account_no')}
                  disabled={!profileLoaded || saving}
                />
              </Field>
              <Field label="Manager / approval limit (INR)" hint="Fill this in to allow claim reviews.">
                <Input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  placeholder="0.00"
                  value={form.approval_limit}
                  onChange={set('approval_limit')}
                  disabled={!profileLoaded || saving}
                />
              </Field>
            </div>
          </Card>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => navigate('/employees')}>
              Cancel
            </Button>
            <Button type="submit" disabled={!employees || !profileLoaded || saving}>
              <Icon name="check" size={16} />
              {saving ? 'Saving...' : 'Save employee'}
            </Button>
          </div>
        </div>
        <aside className="form-aside">
          <Card title="A connected team">
            <span className="stat-icon tone-green">
              <Icon name="users" size={28} />
            </span>
            <p className="form-note">
              Departments organize your team. Supervisors define reporting relationships. Roles control what
              each person can do.
            </p>
          </Card>
          <Notice>
            Leave a role field empty to remove that role. Existing claims may prevent removing a role.
          </Notice>
        </aside>
      </form>
    </>
  );
}
