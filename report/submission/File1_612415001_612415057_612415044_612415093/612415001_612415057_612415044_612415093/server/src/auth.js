// Login with email + password, JWT for later requests, role checks.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { HttpError } from './errors.js';

const SECRET = process.env.JWT_SECRET;

// The user's roles come from the subclass tables (overlapping ISA):
// a row in applicant = may file claims; a row in manager = may decide claims.
export async function loadUser(employeeId) {
  const rows = await query(
    `SELECT e.employee_id AS id, e.name, e.email, e.designation, d.dept_name,
            a.employee_id IS NOT NULL AS is_applicant,
            m.employee_id IS NOT NULL AS is_manager,
            m.approval_limit
     FROM employee e
     JOIN department d ON d.dept_id = e.dept_id
     LEFT JOIN applicant a ON a.employee_id = e.employee_id
     LEFT JOIN manager   m ON m.employee_id = e.employee_id
     WHERE e.employee_id = ?`,
    [employeeId],
  );
  if (!rows.length) return null;
  const u = rows[0];
  return { ...u, is_applicant: !!u.is_applicant, is_manager: !!u.is_manager };
}

export async function login(email, password) {
  const rows = await query('SELECT employee_id, password_hash FROM employee WHERE email = ?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    throw new HttpError(401, 'Wrong email or password.');
  }
  const user = await loadUser(rows[0].employee_id);
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '8h' });
  return { token, user };
}

export const hashPassword = (password) => bcrypt.hash(password, 10);

// Middleware: needs "Authorization: Bearer <token>". Roles are re-read on every
// request, so a role change takes effect immediately.
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  let payload;
  try {
    payload = jwt.verify(token ?? '', SECRET);
  } catch {
    return next(new HttpError(401, 'Please log in.'));
  }
  req.user = await loadUser(payload.id);
  if (!req.user) return next(new HttpError(401, 'Please log in.'));
  next();
}

export function requireManager(req, res, next) {
  if (!req.user.is_manager) return next(new HttpError(403, 'Only managers can do this.'));
  next();
}

export function requireApplicant(req, res, next) {
  if (!req.user.is_applicant) return next(new HttpError(403, 'Only registered applicants can file claims.'));
  next();
}
