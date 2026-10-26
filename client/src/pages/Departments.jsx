import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Button, Card, ErrorBanner, Field, Input, Loading, PageHeader } from '../components/ui.jsx';

function DepartmentRow({ dept, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dept.dept_name);
  const [location, setLocation] = useState(dept.location);

  async function save() {
    try {
      await api(`/admin/departments/${dept.dept_id}`, { method: 'PUT', body: { dept_name: name, location } });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${dept.dept_name}?`)) return;
    try {
      await api(`/admin/departments/${dept.dept_id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      onError(err);
    }
  }

  if (editing) {
    return (
      <tr>
        <td className="px-5 py-2"><Input value={name} onChange={(e) => setName(e.target.value)} /></td>
        <td className="px-5 py-2"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></td>
        <td className="px-5 py-2 text-right">{dept.employee_count}</td>
        <td className="px-5 py-2 text-right whitespace-nowrap">
          <Button onClick={save}>Save</Button>{' '}
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-900">{dept.dept_name}</td>
      <td className="px-5 py-3">{dept.location}</td>
      <td className="px-5 py-3 text-right">{dept.employee_count}</td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
        <Button variant="ghost" onClick={remove}>Delete</Button>
      </td>
    </tr>
  );
}

export default function Departments() {
  const { data, error, loading, reload } = useApi('/admin/departments');
  const [actionError, setActionError] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  async function add(e) {
    e.preventDefault();
    setActionError(null);
    try {
      await api('/admin/departments', { method: 'POST', body: { dept_name: name, location } });
      setName('');
      setLocation('');
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  const changed = () => {
    setActionError(null);
    reload();
  };

  return (
    <>
      <PageHeader title="Departments" subtitle="A department with employees cannot be deleted (foreign key, RESTRICT)" />
      <ErrorBanner error={error ?? actionError} />
      <div className="space-y-6">
        <Card title="Add a department">
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Name"><Input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Location"><Input required maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Button type="submit">Add</Button>
          </form>
        </Card>
        <Card>
          {loading ? (
            <Loading />
          ) : (
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3 text-right">Employees</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.departments.map((d) => (
                    <DepartmentRow key={d.dept_id} dept={d} onChanged={changed} onError={setActionError} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
