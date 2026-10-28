// Master data: departments and employees (with phones, supervisor and roles).
// The design has no separate admin role (decision E4), so managers do this.
import { Router } from 'express';
import { query, transaction } from '../db.js';
import { HttpError } from '../errors.js';
import { hashPassword } from '../auth.js';
import { validateSupervisor } from '../../../shared/validation.mjs';

const router = Router();

// ---------------------------------------------------------------- departments

router.get('/departments', async (req, res) => {
  const rows = await query(
    `SELECT d.*, COUNT(e.employee_id) AS employee_count
     FROM department d
     LEFT JOIN employee e ON e.dept_id = d.dept_id
     GROUP BY d.dept_id
     ORDER BY d.dept_name`,
  );
  res.json(rows);
});

router.post('/departments', async (req, res) => {
  const { dept_name, location } = req.body;
  const r = await query('INSERT INTO department (dept_name, location) VALUES (?, ?)',
    [dept_name?.trim() || null, location?.trim() || null]);
  res.status(201).json({ dept_id: r.insertId });
});

router.put('/departments/:id', async (req, res) => {
  const { dept_name, location } = req.body;
  const r = await query('UPDATE department SET dept_name = ?, location = ? WHERE dept_id = ?',
    [dept_name?.trim() || null, location?.trim() || null, req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Department not found.');
  res.json({ ok: true });
});

// Fails with "still referenced" while the department has employees (RESTRICT)
router.delete('/departments/:id', async (req, res) => {
  const r = await query('DELETE FROM department WHERE dept_id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Department not found.');
  res.json({ ok: true });
});

// ------------------------------------------------------------------ employees

router.get('/employees', async (req, res) => {
  const rows = await query(
    `SELECT e.employee_id, e.name, e.email, e.designation, e.date_of_joining,
            d.dept_name, e.supervisor_id, s.name AS supervisor_name,
            a.employee_id IS NOT NULL AS is_applicant,
            m.approval_limit,
            (SELECT GROUP_CONCAT(p.phone SEPARATOR ', ') FROM employee_phone p
             WHERE p.employee_id = e.employee_id) AS phones
     FROM employee e
     JOIN department d     ON d.dept_id = e.dept_id
     LEFT JOIN employee s  ON s.employee_id = e.supervisor_id
     LEFT JOIN applicant a ON a.employee_id = e.employee_id
     LEFT JOIN manager m   ON m.employee_id = e.employee_id
     ORDER BY e.name`,
  );
  res.json(rows);
});

router.get('/employees/:id', async (req, res) => {
  const [emp] = await query(
    `SELECT e.employee_id, e.name, e.email, e.designation, e.date_of_joining, e.dept_id, e.supervisor_id,
            a.bank_account_no, m.approval_limit
     FROM employee e
     LEFT JOIN applicant a ON a.employee_id = e.employee_id
     LEFT JOIN manager m   ON m.employee_id = e.employee_id
     WHERE e.employee_id = ?`,
    [req.params.id],
  );
  if (!emp) throw new HttpError(404, 'Employee not found.');
  const phones = await query('SELECT phone FROM employee_phone WHERE employee_id = ? ORDER BY phone', [req.params.id]);
  res.json({ ...emp, phones: phones.map((p) => p.phone) });
});

// Writes the employee row, the phone rows and the role rows in one transaction.
async function saveEmployee(conn, id, body) {
  const {
    name, email, designation, date_of_joining, dept_id, supervisor_id,
    phones = [], bank_account_no, approval_limit,
  } = body;
  // Serialize hierarchy writes in this small employee directory so concurrent
  // supervisor changes cannot each validate against an outdated reporting tree.
  const [employees] = await conn.query('SELECT employee_id, supervisor_id FROM employee ORDER BY employee_id FOR UPDATE');
  if (id && !employees.some((employee) => employee.employee_id === id)) throw new HttpError(404, 'Employee not found.');
  const validationError = validateSupervisor(id, supervisor_id, employees);
  if (validationError) throw new HttpError(400, validationError);
  const values = [
    name?.trim() || null, email?.trim().toLowerCase() || null, designation?.trim() || null,
    date_of_joining || null, dept_id || null, supervisor_id || null,
  ];

  if (id) {
    await conn.query(
      `UPDATE employee SET name = ?, email = ?, designation = ?, date_of_joining = ?, dept_id = ?, supervisor_id = ?
       WHERE employee_id = ?`,
      [...values, id],
    );
    if (body.password) {
      await conn.query('UPDATE employee SET password_hash = ? WHERE employee_id = ?', [await hashPassword(body.password), id]);
    }
  } else {
    if (!body.password) throw new HttpError(400, 'A password is required for a new employee.');
    const [r] = await conn.query(
      `INSERT INTO employee (name, email, designation, date_of_joining, dept_id, supervisor_id, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [...values, await hashPassword(body.password)],
    );
    id = r.insertId;
  }

  // Multivalued phone: replace the whole set
  await conn.query('DELETE FROM employee_phone WHERE employee_id = ?', [id]);
  for (const phone of new Set(phones.map((p) => p.trim()).filter(Boolean))) {
    await conn.query('INSERT INTO employee_phone (employee_id, phone) VALUES (?, ?)', [id, phone]);
  }

  // Roles (overlapping, partial): a filled-in field = the role row exists.
  // Removing the applicant role of someone who has claims fails (RESTRICT), as it should.
  if (bank_account_no?.trim()) {
    await conn.query(
      `INSERT INTO applicant (employee_id, bank_account_no) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE bank_account_no = VALUES(bank_account_no)`,
      [id, bank_account_no.trim()],
    );
  } else {
    await conn.query('DELETE FROM applicant WHERE employee_id = ?', [id]);
  }
  if (approval_limit !== undefined && approval_limit !== null && approval_limit !== '') {
    await conn.query(
      `INSERT INTO manager (employee_id, approval_limit) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
      [id, approval_limit],
    );
  } else {
    await conn.query('DELETE FROM manager WHERE employee_id = ?', [id]);
  }
  return id;
}

router.post('/employees', async (req, res) => {
  const id = await transaction((conn) => saveEmployee(conn, null, req.body));
  res.status(201).json({ employee_id: id });
});

router.put('/employees/:id', async (req, res) => {
  const [exists] = await query('SELECT 1 FROM employee WHERE employee_id = ?', [req.params.id]);
  if (!exists) throw new HttpError(404, 'Employee not found.');
  await transaction((conn) => saveEmployee(conn, Number(req.params.id), req.body));
  res.json({ ok: true });
});

// Phones and role rows go with the employee (CASCADE); claims, decisions and
// subordinates block the delete (RESTRICT).
router.delete('/employees/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'You cannot delete yourself.');
  const r = await query('DELETE FROM employee WHERE employee_id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Employee not found.');
  res.json({ ok: true });
});

export default router;
