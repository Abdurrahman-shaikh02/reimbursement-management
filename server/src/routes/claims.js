// Claims: list, detail, submit (applicant); decide and mark paid (manager).
import { Router } from 'express';
import { query, transaction } from '../db.js';
import { HttpError } from '../errors.js';
import { requireApplicant, requireManager } from '../auth.js';
import { removeFiles, upload } from '../uploads.js';
import { CATEGORIES, CLAIM_TYPES, validateClaim, validateClaimAction } from '../../../shared/validation.mjs';

export { CATEGORIES, CLAIM_TYPES };

const router = Router();

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

  // claim_type says which subclass table holds the details
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
    const { claim_type: type, details = {}, items = [] } = data ?? {};

    const receipts = Object.fromEntries((req.files ?? []).map((f) => [f.fieldname, f]));

    const id = await transaction(async (conn) => {
      // Use one database date for validation and storage, including across midnight.
      const [[{ claim_date: claimDate }]] = await conn.query('SELECT CURRENT_DATE AS claim_date');
      const validationError = validateClaim(data, claimDate);
      if (validationError) throw new HttpError(400, validationError);
      const [r] = await conn.query(
        "INSERT INTO reimbursement (applicant_id, claim_type, claim_date, status) VALUES (?, ?, ?, 'SUBMITTED')",
        [req.user.id, type, claimDate],
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

// Lock the claim and current manager limit while validating and saving a decision.
// Claims and their items have no edit endpoints; saved identity, details and items stay read-only.
router.post('/:id/decision', requireManager, async (req, res) => {
  const { decision, remarks = '' } = req.body;
  await transaction(async (conn) => {
    const [[manager]] = await conn.query('SELECT approval_limit FROM manager WHERE employee_id = ? FOR UPDATE', [req.user.id]);
    const [[claim]] = await conn.query('SELECT * FROM reimbursement WHERE reimbursement_id = ? FOR UPDATE', [req.params.id]);
    if (!claim) throw new HttpError(404, 'Claim not found.');
    const [[totals]] = await conn.query(
      'SELECT COUNT(*) AS item_count, COALESCE(SUM(amount), 0) AS total_amount FROM expense_item WHERE reimbursement_id = ?',
      [req.params.id],
    );
    const validationError = validateClaimAction(
      { ...claim, ...totals }, { ...req.user, is_manager: !!manager, approval_limit: manager?.approval_limit }, decision, remarks,
    );
    if (validationError) throw new HttpError(400, validationError);
    await conn.query(
      'UPDATE reimbursement SET status = ?, approved_by = ?, approval_date = CURRENT_DATE, remarks = ? WHERE reimbursement_id = ?',
      [decision, req.user.id, remarks.trim() || null, req.params.id],
    );
  });
  res.json({ ok: true });
});

// A locking read makes concurrent decisions/payments see the latest saved status.
router.post('/:id/pay', requireManager, async (req, res) => {
  await transaction(async (conn) => {
    const [[claim]] = await conn.query('SELECT * FROM reimbursement WHERE reimbursement_id = ? FOR UPDATE', [req.params.id]);
    if (!claim) throw new HttpError(404, 'Claim not found.');
    const validationError = validateClaimAction(claim, req.user, 'PAID');
    if (validationError) throw new HttpError(400, validationError);
    await conn.query("UPDATE reimbursement SET status = 'PAID' WHERE reimbursement_id = ?", [req.params.id]);
  });
  res.json({ ok: true });
});

export default router;
