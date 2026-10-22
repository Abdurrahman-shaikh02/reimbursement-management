import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Table, Td } from '../components/ui.jsx';

export default function Employees() {
  const { data: employees, error: loadError, reload } = useLoad('/admin/employees');
  const [error, setError] = useState('');

  const remove = async (e) => {
    if (!window.confirm(`Delete ${e.name}?`)) return;
    setError('');
    try {
      await api(`/admin/employees/${e.employee_id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card title="Employees" actions={<Link to="/employees/new" className="text-sm text-blue-700 underline">Add employee</Link>}>
      <ErrorBox error={loadError || error} />
      <Table headers={['Name', 'Email', 'Designation', 'Department', 'Supervisor', 'Phones', 'Roles', '']}>
        {employees?.map((e) => (
          <tr key={e.employee_id}>
            <Td><Link className="text-blue-700 underline" to={`/employees/${e.employee_id}`}>{e.name}</Link></Td>
            <Td>{e.email}</Td>
            <Td>{e.designation}</Td>
            <Td>{e.dept_name}</Td>
            <Td>{e.supervisor_name ?? '—'}</Td>
            <Td>{e.phones ?? '—'}</Td>
            <Td>
              {[e.is_applicant ? 'applicant' : null, e.approval_limit != null ? `manager (${money(e.approval_limit)})` : null]
                .filter(Boolean).join(', ') || '—'}
            </Td>
            <Td><Button variant="danger" onClick={() => remove(e)}>Delete</Button></Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
