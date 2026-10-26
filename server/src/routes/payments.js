import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { loadClaim } from './claims.js';

export const paymentsRouter = Router();

// Approved claims waiting for payment, with the payee's bank details.
// Claims this admin filed or approved are left out: the CHECK constraints
// would reject those payments anyway (separation of duties).
paymentsRouter.get('/queue', async (req, res) => {
  const me = req.user.employee_id;
  const claims = await query(
    `SELECT s.*, a.bank_account_no, a.ifsc_code
       FROM reimbursement_summary s
       JOIN applicant a ON a.employee_id = s.applicant_id
      WHERE s.status = 'APPROVED'
        AND s.applicant_id <> ?
        AND s.reviewed_by <> ?
      ORDER BY s.review_date, s.reimbursement_id`,
    [me, me],
  );
  res.json({ claims });
});

paymentsRouter.get('/history', async (req, res) => {
  const claims = await query(
    `SELECT * FROM reimbursement_summary
      WHERE status = 'PAID'
      ORDER BY payment_date DESC, reimbursement_id DESC`,
  );
  res.json({ claims });
});

// Records the PAYS relationship.
paymentsRouter.post('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const paymentRef = String(req.body?.payment_ref ?? '').trim().toUpperCase();
  if (!paymentRef) throw new HttpError(422, 'Enter the bank transfer reference (UTR).');

  const result = await query(
    `UPDATE reimbursement
        SET status = 'PAID', paid_by = ?, payment_date = CURRENT_DATE, payment_ref = ?
      WHERE reimbursement_id = ? AND status = 'APPROVED'`,
    [req.user.employee_id, paymentRef, id],
  );
  if (result.affectedRows === 0) {
    throw new HttpError(409, 'This claim was not found or is not waiting for payment.');
  }
  res.json({ claim: await loadClaim(id) });
});
