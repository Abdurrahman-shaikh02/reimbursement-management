import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth.jsx';
import { Chip } from './ui.jsx';

function navItems(roles) {
  const items = [{ to: '/', label: 'Dashboard', end: true }];
  if (roles.applicant) {
    items.push({ to: '/claims', label: 'My claims', end: true }, { to: '/claims/new', label: 'New claim' });
  }
  if (roles.manager) items.push({ to: '/reviews', label: 'Review queue' });
  if (roles.admin) items.push({ to: '/payments', label: 'Payments' });
  if (roles.manager || roles.admin) items.push({ to: '/reports', label: 'Reports' });
  if (roles.admin) {
    items.push({ to: '/admin/employees', label: 'Employees' }, { to: '/admin/departments', label: 'Departments' });
  }
  return items;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const items = navItems(user.roles);

  const linkClass = ({ isActive }) =>
    `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="md:sticky md:top-0">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">₹</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Reimbursements</p>
            <p className="text-xs text-slate-500">RMS</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.designation} · {user.dept_name}</p>
          </div>
          <div className="flex gap-1">
            {user.roles.applicant && <Chip tone="indigo">Applicant</Chip>}
            {user.roles.manager && <Chip tone="violet">Manager</Chip>}
            {user.roles.admin && <Chip tone="teal">Admin</Chip>}
          </div>
          <button type="button" onClick={logout} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
