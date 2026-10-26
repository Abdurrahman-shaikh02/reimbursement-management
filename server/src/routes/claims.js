import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { requireRole } from '../auth.js';
import { receiptUpload, removeFiles } from '../uploads.js';
import { CLAIM_TYPES } from '../domain.js';

export const claimsRouter = Router();

claimsRouter.get('/mine', async (req, res) => {
  const claims = await query(
    `SELECT * FROM reimbursement_summary
      WHERE applicant_id = ?
      ORDER BY claim_date DESC, reimbursement_id DESC`,
    [req.user.employee_id],
  );
  res.json({ claims });
});

// Details of one claim: the summary row, its type-specific details and its items.
export async function loadClaim(id) {
  const [claim] = await query('SELECT * FROM reimbursement_summary WHERE reimbursement_id = ?', [id]);
  if (!claim) return null;

  // A table name cannot be a ? placeholder; it comes from this fixed map, never from input.
  const detailTable = {
    TRAVEL: 'travel_reimbursement',
    MEDICAL: 'medical_reimbursement',
    BUSINESS: 'business_reimbursement',
  }[claim.claim_type];
  const [details] = await query(`SELECT * FROM ${detailTable} WHERE reimbursement_id = ?`, [id]);

  const items = await query(
    `SELECT item_no, category, description, amount, expense_date, receipt_path
       FROM expense_item WHERE reimbursement_id = ? ORDER BY item_no`,
    [id],
  );
  const [bank] = await query(
    'SELECT bank_account_no, ifsc_code FROM applicant WHERE employee_id = ?',
    [claim.applicant_id],
  );
  return { ...claim, details: details ?? null, items, bank };
}

claimsRouter.get('/:id', async (req, res) => {
  const claim = await loadClaim(Number(req.params.id));
  if (!claim) throw new HttpError(404, 'Claim not found.');

  // Applicants see their own claims; managers and admins see any claim.
  const { roles, employee_id } = req.user;
  const isOwner = claim.applicant_id === employee_id;
  if (!isOwner && !roles.manager && !roles.admin) throw new HttpError(404, 'Claim not found.');
  // Bank details are only for the owner and for admins (who pay).
  if (!isOwner && !roles.admin) delete claim.bank;
  res.json({ claim });
});

function parseSubmission(body) {
  let data;
  try {
    data = JSON.parse(body.data ?? '');
  } catch {
    throw new HttpError(400, 'Malformed claim data.');
  }
  const { claim_type, details = {}, items } = data;
  if (!CLAIM_TYPES.includes(claim_type)) throw new HttpError(422, 'Choose a claim type.');
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(422, 'Add at least one expense item.');
  }
  return { claim_type, details, items };
}

// Submitting a claim writes three tables. The transaction makes the claim,
// its type-specific details and its items appear together or not at all;
// this is how the total-participation rules (exactly one details row, at
// least one item) hold even though MySQL cannot defer constraint checks.
claimsRouter.post('/', requireRole('applicant'), receiptUpload.any(), async (req, res) => {
  const files = req.files ?? [];
  try {
    const { claim_type, details, items } = parseSubmission(req.body);
    const receiptFor = (index) => files.find((f) => f.fieldname === `receipt_${index}`)?.filename ?? null;

    const id = await withTransaction(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO reimbursement (applicant_id, claim_type) VALUES (?, ?)',
        [req.user.employee_id, claim_type],
      );
      const reimbursementId = result.insertId;

      if (claim_type === 'TRAVEL') {
        await conn.query(
          `INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km)
           VALUES (?, ?, ?, ?)`,
          [reimbursementId, details.travel_from, details.travel_to, details.distance_km],
        );
      } else if (claim_type === 'MEDICAL') {
        await conn.query(
          `INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type)
           VALUES (?, ?, ?)`,
          [reimbursementId, details.hospital_name, details.treatment_type],
        );
      } else {
        await conn.query(
          `INSERT INTO business_reimbursement (reimbursement_id, purpose, client_name)
           VALUES (?, ?, ?)`,
          [reimbursementId, details.purpose, details.client_name || null],
        );
      }

      // item_no is the weak entity's discriminator: 1, 2, 3 ... within this claim.
      for (const [index, item] of items.entries()) {
        await conn.query(
          `INSERT INTO expense_item
             (reimbursement_id, item_no, category, description, amount, expense_date, receipt_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [reimbursementId, index + 1, item.category, item.description, item.amount,
            item.expense_date, receiptFor(index)],
        );
      }
      return reimbursementId;
    });

    res.status(201).json({ claim: await loadClaim(id) });
  } catch (err) {
    await removeFiles(files.map((f) => f.filename)); // nothing was saved, so drop the uploads
    throw err;
  }
});

// Withdrawing a claim deletes it. trg_reimbursement_bd allows this only
// before review; ON DELETE CASCADE removes its items and details.
claimsRouter.delete('/:id', requireRole('applicant'), async (req, res) => {
  const id = Number(req.params.id);
  const receipts = await query(
    'SELECT receipt_path FROM expense_item WHERE reimbursement_id = ?',
    [id],
  );
  const result = await query(
    'DELETE FROM reimbursement WHERE reimbursement_id = ? AND applicant_id = ?',
    [id, req.user.employee_id],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Claim not found.');
  await removeFiles(receipts.map((r) => r.receipt_path));
  res.status(204).end();
});
