import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { loadClaim } from './claims.js';

export const reviewsRouter = Router();

// Claims this manager may decide: still SUBMITTED, not their own, and within
// their approval limit. The trigger enforces the same rules on the UPDATE;
// this filter only keeps the queue free of claims they could not decide.
reviewsRouter.get('/queue', async (req, res) => {
  const me = req.user.employee_id;
  const claims = await query(
    `SELECT s.*,
            (e.supervisor_id = ?) AS is_subordinate
       FROM reimbursement_summary s
       JOIN employee e ON e.employee_id = s.applicant_id
      WHERE s.status = 'SUBMITTED'
        AND s.applicant_id <> ?
        AND s.total_amount <= ?
      ORDER BY is_subordinate DESC, s.claim_date, s.reimbursement_id`,
    [me, me, req.user.approval_limit],
  );
  const [{ over_limit }] = await query(
    `SELECT COUNT(*) AS over_limit FROM reimbursement_summary
      WHERE status = 'SUBMITTED' AND applicant_id <> ? AND total_amount > ?`,
    [me, req.user.approval_limit],
  );
  res.json({ claims, over_limit, approval_limit: req.user.approval_limit });
});

reviewsRouter.get('/history', async (req, res) => {
  const claims = await query(
    `SELECT * FROM reimbursement_summary
      WHERE reviewed_by = ?
      ORDER BY review_date DESC, reimbursement_id DESC`,
    [req.user.employee_id],
  );
  res.json({ claims });
});

// One UPDATE records the REVIEWS relationship. "AND status = 'SUBMITTED'"
// makes it safe when two managers decide at once: the second update matches
// no row instead of overwriting the first decision.
reviewsRouter.post('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body ?? {};
  const remarks = String(req.body?.remarks ?? '').trim() || null;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new HttpError(422, 'Decision must be APPROVED or REJECTED.');
  }

  const result = await query(
    `UPDATE reimbursement
        SET status = ?, reviewed_by = ?, review_date = CURRENT_DATE, remarks = ?
      WHERE reimbursement_id = ? AND status = 'SUBMITTED'`,
    [decision, req.user.employee_id, remarks, id],
  );
  if (result.affectedRows === 0) {
    throw new HttpError(409, 'This claim was not found or has already been reviewed.');
  }
  res.json({ claim: await loadClaim(id) });
});
