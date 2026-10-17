// Claims: list, detail, submit (applicant); decide and mark paid (manager).
import { Router } from 'express';
import { query, transaction } from '../db.js';
import { HttpError } from '../errors.js';
import { requireApplicant, requireManager } from '../auth.js';
import { removeFiles, upload } from '../uploads.js';

const router = Router();

export const CLAIM_TYPES = ['TRAVEL', 'MEDICAL', 'BUSINESS'];
export const CATEGORIES = ['FOOD', 'LODGING', 'FARE', 'FUEL', 'LOCAL_TRANSPORT', 'MEDICAL', 'SUPPLIES', 'OTHER'];

// My claims, newest first, with the derived total from the view
router.get('/', requireApplicant, async (req, res) => {
  const rows = await query(
    `SELECT s.*, m.name AS approver_name
     FROM reimbursement_summary s
     LEFT JOIN employee m ON m.employee_id = s.approved_by
     WHERE s.applicant_id = ?
     ORDER BY s.claim_date DESC, s.reimbursement_id DESC`,
    [req.user.id],
  );
  res.json(rows);
});

// One claim with its type details and items. Visible to its applicant and to managers.
router.get('/:id', async (req, res) => {
  const [claim] = await query(
    `SELECT s.*, a.name AS applicant_name, d.dept_name, m.name AS approver_name
     FROM reimbursement_summary s
     JOIN employee a   ON a.employee_id = s.applicant_id
     JOIN department d ON d.dept_id = a.dept_id
     LEFT JOIN employee m ON m.employee_id = s.approved_by
     WHERE s.reimbursement_id = ?`,
    [req.params.id],
  );
  if (!claim) throw new HttpError(404, 'Claim not found.');
  if (claim.applicant_id !== req.user.id && !req.user.is_manager) {
    throw new HttpError(403, 'You can only view your own claims.');
  }

  // claim_type says which subclass table holds the details [A6]
  const table = `${claim.claim_type.toLowerCase()}_reimbursement`;
  const [details] = await query(`SELECT * FROM ${table} WHERE reimbursement_id = ?`, [claim.reimbursement_id]);
  const items = await query(
    'SELECT * FROM expense_item WHERE reimbursement_id = ? ORDER BY item_no',
    [claim.reimbursement_id],
  );
  res.json({ ...claim, details: details ?? {}, items });
});

// Submit a claim. Multipart form: field "data" holds the JSON, files "receipt_0",
// "receipt_1", … are the receipts of items 0, 1, …
// Claim, details and items go in ONE transaction, so a claim always has its
// details row and at least one item (application rule A1).
router.post('/', requireApplicant, upload.any(), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data ?? '{}');
    const { claim_type: type, details = {}, items = [] } = data;
    if (!CLAIM_TYPES.includes(type)) throw new HttpError(400, 'Choose a claim type.');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Add at least one expense item.');

    const receipts = Object.fromEntries((req.files ?? []).map((f) => [f.fieldname, f]));

    const id = await transaction(async (conn) => {
      // claim_date is left to its DEFAULT (today): the server sets it, never the form (rule A2)
      const [r] = await conn.query(
        'INSERT INTO reimbursement (applicant_id, claim_type) VALUES (?, ?)',
        [req.user.id, type],
      );
      const claimId = r.insertId;

      if (type === 'TRAVEL') {
        await conn.query(
          'INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km) VALUES (?, ?, ?, ?)',
          [claimId, details.travel_from || null, details.travel_to || null, details.distance_km || null],
        );
      } else if (type === 'MEDICAL') {
        await conn.query(
          'INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type) VALUES (?, ?, ?)',
          [claimId, details.hospital_name || null, details.treatment_type || null],
        );
      } else {
        await conn.query(
          'INSERT INTO business_reimbursement (reimbursement_id, purpose, client_name) VALUES (?, ?, ?)',
          [claimId, details.purpose || null, details.client_name || null],
        );
      }

      for (const [i, item] of items.entries()) {
        const file = receipts[`receipt_${i}`];
        await conn.query(
          `INSERT INTO expense_item
             (reimbursement_id, item_no, category, description, amount, expense_date, receipt_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [claimId, i + 1, item.category || null, item.description || null, item.amount || null,
            item.expense_date || null, file ? `/uploads/${file.filename}` : null],
        );
      }
      return claimId;
    });
    res.status(201).json({ reimbursement_id: id });
  } catch (err) {
    removeFiles(req.files);
    if (err instanceof SyntaxError) throw new HttpError(400, 'Invalid form data.');
    throw err;
  }
});

// Approve or reject. The database checks the rest: not your own claim (C10),
// remarks on rejection (C9), total within your limit (T1).
router.post('/:id/decision', requireManager, async (req, res) => {
  const { decision, remarks } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new HttpError(400, 'Decision must be APPROVED or REJECTED.');

  const result = await query(
    `UPDATE reimbursement
     SET status = ?, approved_by = ?, approval_date = CURRENT_DATE, remarks = ?
     WHERE reimbursement_id = ? AND status = 'SUBMITTED'`,
    [decision, req.user.id, remarks?.trim() || null, req.params.id],
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'This claim is no longer waiting for a decision.');
  res.json({ ok: true });
});

// Mark an approved claim as paid. Not modelled as a role (design decision E4);
// any manager may do it, except for their own claim.
router.post('/:id/pay', requireManager, async (req, res) => {
  const [claim] = await query('SELECT applicant_id FROM reimbursement WHERE reimbursement_id = ?', [req.params.id]);
  if (!claim) throw new HttpError(404, 'Claim not found.');
  if (claim.applicant_id === req.user.id) throw new HttpError(403, 'You cannot mark your own claim as paid.');

  const result = await query(
    "UPDATE reimbursement SET status = 'PAID' WHERE reimbursement_id = ? AND status = 'APPROVED'",
    [req.params.id],
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'Only approved claims can be marked paid.');
  res.json({ ok: true });
});

export default router;
