const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function money(value) {
  return inr.format(Number(value ?? 0));
}

// '2026-10-26' -> '26 Oct 2026'. Dates arrive as plain strings from MySQL.
export function date(value) {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

// 'LOCAL_CONVEYANCE' -> 'Local conveyance'
export function label(code) {
  if (!code) return '';
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function maskAccount(account) {
  if (!account) return '';
  return `•••• ${account.slice(-4)}`;
}
