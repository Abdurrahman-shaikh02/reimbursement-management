import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  ErrorBox,
  PageHeader,
  SearchInput,
  StatGrid,
  Table,
  Td,
} from '../components/ui.jsx';

export default function Employees() {
  const { data: employees, error: loadError, loading, reload } = useLoad('/admin/employees');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const rows = employees ?? [];
  const filtered = rows.filter((employee) =>
    [employee.name, employee.email, employee.designation, employee.dept_name]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const remove = async (employee) => {
    if (!window.confirm(`Delete ${employee.name}?`)) return;
    setError('');
    try {
      await api(`/admin/employees/${employee.employee_id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="YOUR ORGANIZATION"
        title="People & permissions"
        description="The people behind every claim, and the roles that keep things running."
        actions={
          <ButtonLink to="/employees/new">
            <Icon name="plus" size={17} />
            Add employee
          </ButtonLink>
        }
      />
      <StatGrid
        items={[
          {
            label: 'Team members',
            value: employees && rows.length,
            detail: 'In your organization',
            icon: 'users',
          },
          {
            label: 'Applicants',
            value: employees && rows.filter((employee) => employee.is_applicant).length,
            detail: 'Able to submit expenses',
            icon: 'receipt',
            tone: 'blue',
          },
          {
            label: 'Managers',
            value: employees && rows.filter((employee) => employee.approval_limit != null).length,
            detail: 'Reviewing team claims',
            icon: 'shield',
            tone: 'amber',
          },
          {
            label: 'Departments',
            value: employees && new Set(rows.map((employee) => employee.dept_name)).size,
            detail: 'With registered employees',
            icon: 'building',
            tone: 'purple',
          },
        ]}
      />
      <Card title="Employee directory" description="Manage profiles, reporting relationships and access">
        <ErrorBox error={loadError || error} />
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people or departments..."
          />
          <span className="table-meta">{filtered.length} team members</span>
        </div>
        <Table
          loading={loading && !employees}
          headers={['Employee', 'Department', 'Reports to', 'Phone', 'Roles', '']}
          empty="No employees match your search."
        >
          {filtered.map((employee) => (
            <tr key={employee.employee_id}>
              <Td>
                <div className="person-cell">
                  <Avatar name={employee.name} />
                  <div>
                    <Link className="record-link" to={`/employees/${employee.employee_id}`}>
                      {employee.name}
                    </Link>
                    <small>{employee.designation}</small>
                    <small>{employee.email}</small>
                  </div>
                </div>
              </Td>
              <Td>{employee.dept_name}</Td>
              <Td>{employee.supervisor_name ?? 'Top of hierarchy'}</Td>
              <Td className="whitespace-nowrap">{employee.phones || '-'}</Td>
              <Td>
                <div className="tag-group">
                  {employee.is_applicant ? <span className="tag">Applicant</span> : null}
                  {employee.approval_limit != null && (
                    <span className="tag" title={`Approval limit: ${money(employee.approval_limit)}`}>
                      Manager
                    </span>
                  )}
                  {!employee.is_applicant && employee.approval_limit == null && (
                    <span className="tag">Member</span>
                  )}
                </div>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Link
                    to={`/employees/${employee.employee_id}`}
                    className="button button--secondary"
                    aria-label={`Edit ${employee.name}`}
                  >
                    <Icon name="edit" size={14} />
                  </Link>
                  <Button
                    variant="danger"
                    onClick={() => remove(employee)}
                    aria-label={`Delete ${employee.name}`}
                  >
                    <Icon name="trash" size={14} />
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
