import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { HttpError, isStillReferenced } from '../errors.js';

export const adminRouter = Router();

// ---------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------
adminRouter.get('/departments', async (req, res) => {
  const departments = await query(
    `SELECT d.dept_id, d.dept_name, d.location, COUNT(e.employee_id) AS employee_count
       FROM department d
       LEFT JOIN employee e ON e.dept_id = d.dept_id
      GROUP BY d.dept_id, d.dept_name, d.location
      ORDER BY d.dept_name`,
  );
  res.json({ departments });
});

adminRouter.post('/departments', async (req, res) => {
  const { dept_name, location } = req.body ?? {};
  const result = await query(
    'INSERT INTO department (dept_name, location) VALUES (?, ?)',
    [dept_name?.trim(), location?.trim()],
  );
  res.status(201).json({ dept_id: result.insertId });
});

adminRouter.put('/departments/:id', async (req, res) => {
  const { dept_name, location } = req.body ?? {};
  const result = await query(
    'UPDATE department SET dept_name = ?, location = ? WHERE dept_id = ?',
    [dept_name?.trim(), location?.trim(), Number(req.params.id)],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Department not found.');
  res.json({ ok: true });
});

// fk_employee_department (RESTRICT) refuses this while employees remain.
adminRouter.delete('/departments/:id', async (req, res) => {
  let result;
  try {
    result = await query('DELETE FROM department WHERE dept_id = ?', [Number(req.params.id)]);
  } catch (err) {
    if (isStillReferenced(err)) throw new HttpError(409, 'This department still has employees. Move them first.');
    throw err;
  }
  if (result.affectedRows === 0) throw new HttpError(404, 'Department not found.');
  res.status(204).end();
});

// ---------------------------------------------------------------------
// Employees, their phones and their roles (the ISA subclasses)
// ---------------------------------------------------------------------
adminRouter.get('/employees', async (req, res) => {
  const employees = await query(
    `SELECT e.employee_id, e.name, e.email, e.designation, e.date_of_joining,
            d.dept_name, s.name AS supervisor_name,
            r.is_applicant, r.is_manager, r.is_admin, r.approval_limit,
            (SELECT GROUP_CONCAT(p.phone ORDER BY p.phone SEPARATOR ', ')
               FROM employee_phone p WHERE p.employee_id = e.employee_id) AS phones
       FROM employee e
       JOIN department d     ON d.dept_id = e.dept_id
       JOIN employee_roles r ON r.employee_id = e.employee_id
       LEFT JOIN employee s  ON s.employee_id = e.supervisor_id
      ORDER BY e.name`,
  );
  res.json({ employees });
});

adminRouter.get('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [employee] = await query(
    `SELECT e.employee_id, e.name, e.email, e.designation, e.date_of_joining,
            e.dept_id, e.supervisor_id,
            a.bank_account_no, a.ifsc_code, m.approval_limit,
            (a.employee_id IS NOT NULL)  AS is_applicant,
            (m.employee_id IS NOT NULL)  AS is_manager,
            (ad.employee_id IS NOT NULL) AS is_admin
       FROM employee e
       LEFT JOIN applicant a ON a.employee_id = e.employee_id
       LEFT JOIN manager   m ON m.employee_id = e.employee_id
       LEFT JOIN admin    ad ON ad.employee_id = e.employee_id
      WHERE e.employee_id = ?`,
    [id],
  );
  if (!employee) throw new HttpError(404, 'Employee not found.');
  const phones = await query(
    'SELECT phone FROM employee_phone WHERE employee_id = ? ORDER BY phone',
    [id],
  );
  res.json({ employee: { ...employee, phones: phones.map((p) => p.phone) } });
});

function cleanPhones(phones) {
  return [...new Set((phones ?? []).map((p) => String(p).replace(/[\s-]/g, '')).filter(Boolean))];
}

const ROLE_IN_USE = {
  applicant: 'This employee has claims on record, so they must stay an applicant (financial records are kept).',
  manager: 'This employee has reviewed claims, so the manager role must stay (audit trail).',
  admin: 'This employee has paid claims, so the admin role must stay (audit trail).',
};

// Inserts, updates or deletes the employee's row in one subclass table so
// that it matches the form. Removing a role whose history is referenced
// (e.g. a manager who reviewed claims) is refused by the foreign key.
async function syncRole(conn, table, employeeId, wanted, columns) {
  const [existing] = await conn.query(`SELECT 1 FROM ${table} WHERE employee_id = ?`, [employeeId]);
  const names = Object.keys(columns);
  const values = Object.values(columns);
  if (wanted && existing.length === 0) {
    const cols = ['employee_id', ...names].join(', ');
    const marks = ['?', ...names.map(() => '?')].join(', ');
    await conn.query(`INSERT INTO ${table} (${cols}) VALUES (${marks})`, [employeeId, ...values]);
  } else if (wanted && names.length > 0) {
    const sets = names.map((n) => `${n} = ?`).join(', ');
    await conn.query(`UPDATE ${table} SET ${sets} WHERE employee_id = ?`, [...values, employeeId]);
  } else if (!wanted && existing.length > 0) {
    try {
      await conn.query(`DELETE FROM ${table} WHERE employee_id = ?`, [employeeId]);
    } catch (err) {
      if (isStillReferenced(err)) throw new HttpError(409, ROLE_IN_USE[table]);
      throw err;
    }
  }
}

// Table and column names below are fixed strings, never user input.
async function saveRolesAndPhones(conn, employeeId, body) {
  await conn.query('DELETE FROM employee_phone WHERE employee_id = ?', [employeeId]);
  for (const phone of cleanPhones(body.phones)) {
    await conn.query('INSERT INTO employee_phone (employee_id, phone) VALUES (?, ?)', [employeeId, phone]);
  }
  await syncRole(conn, 'applicant', employeeId, Boolean(body.is_applicant), {
    bank_account_no: body.bank_account_no?.trim(),
    ifsc_code: body.ifsc_code?.trim().toUpperCase(),
  });
  await syncRole(conn, 'manager', employeeId, Boolean(body.is_manager), {
    approval_limit: body.approval_limit,
  });
  await syncRole(conn, 'admin', employeeId, Boolean(body.is_admin), {});
}

function employeeFields(body) {
  return [
    body.name?.trim(),
    body.email?.trim().toLowerCase(),
    body.designation?.trim(),
    body.date_of_joining || null,
    body.dept_id || null,
    body.supervisor_id || null,
  ];
}

// Employee, phones and roles are written in one transaction, so a bad bank
// account number (say) leaves no half-created employee behind.
adminRouter.post('/employees', async (req, res) => {
  const body = req.body ?? {};
  if (!body.password || String(body.password).length < 8) {
    throw new HttpError(422, 'The initial password must have at least 8 characters.');
  }
  const hash = await bcrypt.hash(String(body.password), 10);
  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO employee (name, email, designation, date_of_joining, dept_id, supervisor_id, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [...employeeFields(body), hash],
    );
    await saveRolesAndPhones(conn, result.insertId, body);
    return result.insertId;
  });
  res.status(201).json({ employee_id: id });
});

adminRouter.put('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  if (body.password && String(body.password).length < 8) {
    throw new HttpError(422, 'A new password must have at least 8 characters.');
  }
  const hash = body.password ? await bcrypt.hash(String(body.password), 10) : null;
  await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `UPDATE employee
          SET name = ?, email = ?, designation = ?, date_of_joining = ?, dept_id = ?, supervisor_id = ?,
              password_hash = COALESCE(?, password_hash)
        WHERE employee_id = ?`,
      [...employeeFields(body), hash, id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Employee not found.');
    await saveRolesAndPhones(conn, id, body);
  });
  res.json({ ok: true });
});

// RESTRICT foreign keys refuse this for anyone with claims, reviews,
// payments or subordinates on record. Their phones and role rows cascade.
adminRouter.delete('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.employee_id) throw new HttpError(422, 'You cannot delete your own account.');
  let result;
  try {
    result = await query('DELETE FROM employee WHERE employee_id = ?', [id]);
  } catch (err) {
    if (isStillReferenced(err)) {
      throw new HttpError(409, 'This employee has claims, reviews, payments or subordinates on record and cannot be deleted.');
    }
    throw err;
  }
  if (result.affectedRows === 0) throw new HttpError(404, 'Employee not found.');
  res.status(204).end();
});
