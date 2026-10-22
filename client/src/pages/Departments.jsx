import { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Input, Table, Td } from '../components/ui.jsx';

export default function Departments() {
  const { data: departments, error: loadError, reload } = useLoad('/admin/departments');
  const [form, setForm] = useState({ dept_name: '', location: '' });
  const [editing, setEditing] = useState(null); // dept_id being edited, or null for "add"
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      setForm({ dept_name: '', location: '' });
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const save = (e) => {
    e.preventDefault();
    run(() => (editing
      ? api(`/admin/departments/${editing}`, { method: 'PUT', body: form })
      : api('/admin/departments', { method: 'POST', body: form })));
  };

  return (
    <Card title="Departments">
      <ErrorBox error={loadError || error} />
      <form onSubmit={save} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="w-56"><Input placeholder="Name" value={form.dept_name} onChange={(e) => setForm({ ...form, dept_name: e.target.value })} /></div>
        <div className="w-56"><Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <Button type="submit">{editing ? 'Save' : 'Add department'}</Button>
        {editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm({ dept_name: '', location: '' }); }}>Cancel</Button>}
      </form>
      <Table headers={['Name', 'Location', 'Employees', '']}>
        {departments?.map((d) => (
          <tr key={d.dept_id}>
            <Td>{d.dept_name}</Td>
            <Td>{d.location}</Td>
            <Td>{d.employee_count}</Td>
            <Td className="space-x-2 text-right">
              <Button variant="secondary" onClick={() => { setEditing(d.dept_id); setForm({ dept_name: d.dept_name, location: d.location }); }}>Edit</Button>
              <Button variant="danger" onClick={() => window.confirm(`Delete ${d.dept_name}?`) && run(() => api(`/admin/departments/${d.dept_id}`, { method: 'DELETE' }))}>Delete</Button>
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
