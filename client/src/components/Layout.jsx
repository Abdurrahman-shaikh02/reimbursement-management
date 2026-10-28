import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, ButtonLink } from './ui.jsx';

export default function Layout({ user, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const groups = [
    {
      title: 'Workspace',
      links: [
        user.is_applicant && ['/claims', 'My claims', 'receipt'],
        user.is_manager && ['/approvals', 'Approvals', 'approvals'],
        user.is_manager && ['/payments', 'Payments', 'wallet'],
      ].filter(Boolean),
    },
    {
      title: 'Organization',
      links: [
        user.is_manager && ['/employees', 'Employees', 'users'],
        user.is_manager && ['/departments', 'Departments', 'building'],
      ].filter(Boolean),
    },
    {
      title: 'Insights',
      links: [user.is_manager && ['/reports', 'Reports & analytics', 'chart']].filter(Boolean),
    },
  ].filter((group) => group.links.length);
  const current = groups.flatMap((group) => group.links).find(([path]) => pathname.startsWith(path));
  const title = pathname === '/claims/new' ? 'New claim' : (current?.[1] ?? 'Workspace');
  const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(),
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mobile-bar">
        <span className="brand">
          <span className="brand-mark">
            <Icon name="receipt" size={23} />
          </span>
          Reimburse<span className="brand-dot">.</span>
        </span>
        <button
          className="icon-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </div>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <span className="brand">
            <span className="brand-mark">
              <Icon name="receipt" size={23} />
            </span>
            Reimburse<span className="brand-dot">.</span>
          </span>
          <span className="brand-caption">EXPENSE MANAGEMENT</span>
        </div>
        {user.is_applicant && (
          <ButtonLink to="/claims/new" className="sidebar-create">
            <Icon name="plus" size={18} />
            Create a claim
          </ButtonLink>
        )}
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-label">{group.title}</p>
              {group.links.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/claims'}
                  className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                >
                  <Icon name={icon} size={20} />
                  <span>{label}</span>
                  <Icon name="chevron" size={14} className="nav-chevron" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <Icon name="shield" size={20} />
            <div>
              <strong>Everything accounted for.</strong>
              <p>One place for every expense.</p>
            </div>
          </div>
          <div className="sidebar-profile">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.is_manager ? 'Manager' : user.is_applicant ? 'Applicant' : 'Member'}</span>
            </div>
            <button
              className="icon-button logout-button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" size={19} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chevron" size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              <Icon name="calendar" size={16} />
              {date}
            </span>
            <span className="workspace-pill">
              <span />
              {user.dept_name}
            </span>
            <Avatar name={user.name} small />
          </div>
        </header>
        <main id="main-content" className="page-content" key={pathname}>
          {children}
          <footer className="page-footer">
            <span>Reimburse / Expense management</span>
            <span>Clarity in every claim.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
