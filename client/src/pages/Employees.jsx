import { Link } from 'react-router';
import { useApi } from '../useApi.js';
import { money } from '../format.js';
import { Card, Chip, ErrorBanner, LinkButton, Loading, PageHeader } from '../components/ui.jsx';

export default function Employees() {
  const { data, error, loading } = useApi('/admin/employees');

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Roles are rows in the applicant, manager and admin tables; one person can hold several"
        actions={<LinkButton to="/admin/employees/new">Add employee</LinkButton>}
      />
      <ErrorBanner error={error} />
      <Card>
        {loading ? (
          <Loading />
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Reports to</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Phones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.employees.map((e) => (
                  <tr key={e.employee_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/admin/employees/${e.employee_id}`} className="font-medium text-indigo-600 hover:underline">{e.name}</Link>
                      <div className="text-xs text-slate-500">{e.designation} · {e.email}</div>
                    </td>
                    <td className="px-5 py-3">{e.dept_name}</td>
                    <td className="px-5 py-3">{e.supervisor_name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {e.is_applicant ? <Chip tone="indigo">Applicant</Chip> : null}
                        {e.is_manager ? <Chip tone="violet">Manager · {money(e.approval_limit)}</Chip> : null}
                        {e.is_admin ? <Chip tone="teal">Admin</Chip> : null}
                        {!e.is_applicant && !e.is_manager && !e.is_admin && <span className="text-xs text-slate-400">No role yet</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{e.phones ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
