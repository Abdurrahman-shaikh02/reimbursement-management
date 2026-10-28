import { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../useLoad.js';
import Icon from '../components/Icon.jsx';
import { Button, Card, ErrorBox, Field, Input, PageHeader, StatGrid, Table, Td } from '../components/ui.jsx';

export default function Departments() {
  const { data: departments, error: loadError, loading, reload } = useLoad('/admin/departments');
  const [form, setForm] = useState({ dept_name: '', location: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = departments ?? [];

  const run = async (operation) => {
    setError('');
    setSaving(true);
    try {
      await operation();
      setForm({ dept_name: '', location: '' });
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    run(() =>
      editing
        ? api(`/admin/departments/${editing}`, { method: 'PUT', body: form })
        : api('/admin/departments', { method: 'POST', body: form }),
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="YOUR ORGANIZATION"
        title="Departments"
        description="Give every team a home. Keep your organization connected."
      />
      <StatGrid
        items={[
          {
            label: 'Departments',
            value: departments && rows.length,
            detail: 'Across your organization',
            icon: 'building',
          },
          {
            label: 'Employees',
            value:
              departments && rows.reduce((sum, department) => sum + Number(department.employee_count), 0),
            detail: 'Assigned to a department',
            icon: 'users',
            tone: 'blue',
          },
          {
            label: 'Locations',
            value: departments && new Set(rows.map((department) => department.location)).size,
            detail: 'Unique office locations',
            icon: 'grid',
            tone: 'purple',
          },
          {
            label: 'Active teams',
            value: departments && rows.filter((department) => department.employee_count > 0).length,
            detail: 'With at least one employee',
            icon: 'check',
            tone: 'amber',
          },
        ]}
      />
      <Card title="Department directory" description="Add a team or update an existing department">
        <ErrorBox error={loadError || error} />
        <form onSubmit={save} className="department-form">
          <Field label="Department name">
            <Input
              required
              maxLength={60}
              placeholder="e.g. Engineering"
              value={form.dept_name}
              onChange={(event) => setForm({ ...form, dept_name: event.target.value })}
            />
          </Field>
          <Field label="Location">
            <Input
              required
              maxLength={60}
              placeholder="e.g. Pune"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </Field>
          <Button type="submit" disabled={saving}>
            <Icon name={editing ? 'check' : 'plus'} size={16} />
            {editing ? 'Save changes' : 'Add department'}
          </Button>
          {editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setForm({ dept_name: '', location: '' });
              }}
            >
              Cancel
            </Button>
          )}
        </form>
        <Table
          loading={loading && !departments}
          headers={['Department', 'Location', 'Team size', '']}
          empty="Create your first department."
        >
          {rows.map((department) => (
            <tr key={department.dept_id}>
              <Td>
                <div className="person-cell">
                  <span className="stat-icon tone-green">
                    <Icon name="building" size={18} />
                  </span>
                  <strong>{department.dept_name}</strong>
                </div>
              </Td>
              <Td>{department.location}</Td>
              <Td>
                <span className="tag">{department.employee_count} employees</span>
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(department.dept_id);
                      setForm({ dept_name: department.dept_name, location: department.location });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Icon name="edit" size={14} />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    disabled={saving}
                    onClick={() =>
                      window.confirm(`Delete ${department.dept_name}?`) &&
                      run(() => api(`/admin/departments/${department.dept_id}`, { method: 'DELETE' }))
                    }
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
