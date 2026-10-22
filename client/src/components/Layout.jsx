import { NavLink } from 'react-router-dom';

// Top bar with the links this user's roles allow
export default function Layout({ user, onLogout, children }) {
  const links = [
    user.is_applicant && ['/claims', 'My claims'],
    user.is_applicant && ['/claims/new', 'New claim'],
    user.is_manager && ['/approvals', 'Approvals'],
    user.is_manager && ['/payments', 'Payments'],
    user.is_manager && ['/employees', 'Employees'],
    user.is_manager && ['/departments', 'Departments'],
    user.is_manager && ['/reports', 'Reports'],
  ].filter(Boolean);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold text-blue-700">Reimbursements</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) => (isActive ? 'font-semibold text-blue-700' : 'text-gray-600 hover:text-gray-900')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {user.name}
              <span className="text-gray-400"> · {[user.is_applicant && 'applicant', user.is_manager && 'manager'].filter(Boolean).join(', ') || 'no role'}</span>
            </span>
            <button onClick={onLogout} className="text-gray-600 underline hover:text-gray-900">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
