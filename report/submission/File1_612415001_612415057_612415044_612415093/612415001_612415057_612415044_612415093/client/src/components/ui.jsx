import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props} />;
}

export function ButtonLink({ to, children, variant = 'primary', className = '' }) {
  return (
    <Link to={to} className={`button button--${variant} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = '', ...props }) {
  return <select className={`input select ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`input textarea ${className}`} rows={3} {...props} />;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert--error" role="alert">
      <Icon name="info" />
      <span>{error}</span>
    </div>
  );
}

export function Notice({ children }) {
  return (
    <div className="notice">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Card({ title, description, children, actions, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow = 'Your workspace', title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatGrid({ items }) {
  return (
    <div className="stats-grid">
      {items.map(({ label, value, detail, icon = 'chart', tone = 'green' }) => (
        <div className="stat-card" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <span className={`stat-icon tone-${tone}`}>
              <Icon name={icon} size={19} />
            </span>
          </div>
          <strong className="stat-value">{value ?? <span className="skeleton skeleton-number" />}</strong>
          {detail && <span className="stat-detail">{detail}</span>}
        </div>
      ))}
    </div>
  );
}

export function Table({ headers, children, empty = 'No records yet.', loading = false }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th scope="col" key={index}>
                {header || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={headers.length}>
                <Loading label="Loading records" />
              </td>
            </tr>
          ) : rows && (!Array.isArray(rows) || rows.length) ? (
            rows
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="receipt" size={26} />
                  </span>
                  <strong>{empty}</strong>
                  <p>Your records will appear here when available.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ className = '', ...props }) {
  return <td className={className} {...props} />;
}

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status?.toLowerCase()}`}>
      <span />
      {status === 'SUBMITTED' ? 'Pending review' : status?.charAt(0) + status?.slice(1).toLowerCase()}
    </span>
  );
}

export function Loading({ label = 'Loading your workspace' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <span>{label}...</span>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search records...' }) {
  return (
    <div className="search-input">
      <Icon name="search" size={18} />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function Avatar({ name, small = false }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <span className={`avatar ${small ? 'avatar--small' : ''}`} aria-hidden="true">
      {initials}
    </span>
  );
}
