import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { HttpError } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret';

// Roles come from the overlapping ISA tables (applicant / manager / admin),
// read through the employee_roles view on every request. A role granted or
// removed by an admin takes effect immediately, not at the next login.
async function loadUser(employeeId) {
  const rows = await query(
    `SELECT e.employee_id, e.name, e.email, e.designation, d.dept_name,
            r.is_applicant, r.is_manager, r.is_admin, r.approval_limit
       FROM employee e
       JOIN department d     ON d.dept_id = e.dept_id
       JOIN employee_roles r ON r.employee_id = e.employee_id
      WHERE e.employee_id = ?`,
    [employeeId],
  );
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    employee_id: u.employee_id,
    name: u.name,
    email: u.email,
    designation: u.designation,
    dept_name: u.dept_name,
    roles: {
      applicant: Boolean(u.is_applicant),
      manager: Boolean(u.is_manager),
      admin: Boolean(u.is_admin),
    },
    approval_limit: u.approval_limit,
  };
}

export async function requireAuth(req, res, next) {
  const header = req.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in.'));
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  const user = await loadUser(payload.sub);
  if (!user) return next(new HttpError(401, 'This account no longer exists.'));
  req.user = user;
  next();
}

// Allows the request if the user holds at least one of the given roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.some((role) => req.user.roles[role])) {
      return next(new HttpError(403, `This page needs the ${roles.join(' or ')} role.`));
    }
    next();
  };
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required.');

  const rows = await query(
    'SELECT employee_id, password_hash FROM employee WHERE email = ?',
    [String(email).trim().toLowerCase()],
  );
  const match = rows.length > 0 && (await bcrypt.compare(String(password), rows[0].password_hash));
  if (!match) throw new HttpError(401, 'Incorrect email or password.');

  const token = jwt.sign({ sub: rows[0].employee_id }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: await loadUser(rows[0].employee_id) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
