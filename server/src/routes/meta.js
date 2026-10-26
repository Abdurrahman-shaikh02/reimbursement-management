import { Router } from 'express';
import { query } from '../db.js';
import { CATEGORIES, CLAIM_TYPES, STATUSES, TREATMENT_TYPES } from '../domain.js';

export const metaRouter = Router();

// Drop-down values and the lists the forms need.
metaRouter.get('/', async (req, res) => {
  const [departments, employees] = await Promise.all([
    query('SELECT dept_id, dept_name FROM department ORDER BY dept_name'),
    query('SELECT employee_id, name FROM employee ORDER BY name'),
  ]);
  res.json({
    claimTypes: CLAIM_TYPES,
    statuses: STATUSES,
    categories: CATEGORIES,
    treatmentTypes: TREATMENT_TYPES,
    departments,
    employees,
  });
});

// Numbers for the dashboard cards, depending on the user's roles.
metaRouter.get('/dashboard', async (req, res) => {
  const { employee_id: me, roles, approval_limit } = req.user;
  const result = {};

  if (roles.applicant) {
    result.myClaims = await query(
      `SELECT status, COUNT(*) AS claims, SUM(total_amount) AS amount
         FROM reimbursement_summary WHERE applicant_id = ? GROUP BY status`,
      [me],
    );
    result.recent = await query(
      `SELECT * FROM reimbursement_summary WHERE applicant_id = ?
        ORDER BY claim_date DESC, reimbursement_id DESC LIMIT 5`,
      [me],
    );
  }
  if (roles.manager) {
    const [row] = await query(
      `SELECT COUNT(*) AS claims, COALESCE(SUM(total_amount), 0) AS amount
         FROM reimbursement_summary
        WHERE status = 'SUBMITTED' AND applicant_id <> ? AND total_amount <= ?`,
      [me, approval_limit],
    );
    result.pendingReviews = row;
  }
  if (roles.admin) {
    const [row] = await query(
      `SELECT COUNT(*) AS claims, COALESCE(SUM(total_amount), 0) AS amount
         FROM reimbursement_summary
        WHERE status = 'APPROVED' AND applicant_id <> ? AND reviewed_by <> ?`,
      [me, me],
    );
    result.pendingPayments = row;
  }
  res.json(result);
});
