// A few shared building blocks, styled with Tailwind.
export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white border border-gray-300 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
  };
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';
export const Input = (props) => <input className={inputClass} {...props} />;
export const Select = (props) => <select className={inputClass} {...props} />;
export const Textarea = (props) => <textarea className={inputClass} rows={3} {...props} />;

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;
}

export function Card({ title, children, actions }) {
  return (
    <section className="mb-6 rounded border border-gray-200 bg-white p-4">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Table({ headers, children, empty = 'Nothing to show.' }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            {headers.map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows && (!Array.isArray(rows) || rows.length)
            ? rows
            : <tr><td colSpan={headers.length} className="px-2 py-4 text-center text-gray-500">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export const Td = ({ className = '', ...props }) => <td className={`border-b border-gray-100 px-2 py-2 ${className}`} {...props} />;

const STATUS_COLORS = {
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};
export function StatusBadge({ status }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>{status}</span>;
}
