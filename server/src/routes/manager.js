// Manager screens: the approval queue, claims waiting for payment, reports.
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Submitted claims this manager may decide: not their own, total within their limit (FR6)
router.get('/approvals', async (req, res) => {
  const rows = await query(
    `SELECT s.*, e.name AS applicant_name, d.dept_name
     FROM reimbursement_summary s
     JOIN employee e   ON e.employee_id = s.applicant_id
     JOIN department d ON d.dept_id = e.dept_id
     WHERE s.status = 'SUBMITTED'
       AND s.applicant_id <> ?
       AND s.total_amount <= ?
     ORDER BY s.claim_date, s.reimbursement_id`,
    [req.user.id, req.user.approval_limit],
  );
  res.json(rows);
});

// Approved claims waiting to be paid, with the account the money goes to
router.get('/payments', async (req, res) => {
  const rows = await query(
    `SELECT s.*, e.name AS applicant_name, a.bank_account_no, m.name AS approver_name
     FROM reimbursement_summary s
     JOIN employee e  ON e.employee_id = s.applicant_id
     JOIN applicant a ON a.employee_id = s.applicant_id
     JOIN employee m  ON m.employee_id = s.approved_by
     WHERE s.status = 'APPROVED'
     ORDER BY s.approval_date, s.reimbursement_id`,
  );
  res.json(rows);
});

// Reports (FR9). Rejected claims are left out of the money totals.
router.get('/reports', async (req, res) => {
  const [byDepartment, byType, byCategory, byMonth, byStatus] = await Promise.all([
    query(
      `SELECT d.dept_name AS label, COUNT(DISTINCT r.reimbursement_id) AS claims, COALESCE(SUM(i.amount), 0) AS total
       FROM department d
       LEFT JOIN employee e      ON e.dept_id = d.dept_id
       LEFT JOIN reimbursement r ON r.applicant_id = e.employee_id AND r.status <> 'REJECTED'
       LEFT JOIN expense_item i  ON i.reimbursement_id = r.reimbursement_id
       GROUP BY d.dept_id, d.dept_name
       ORDER BY total DESC`,
    ),
    query(
      `SELECT claim_type AS label, COUNT(*) AS claims, SUM(total_amount) AS total
       FROM reimbursement_summary
       WHERE status <> 'REJECTED'
       GROUP BY claim_type
       ORDER BY total DESC`,
    ),
    query(
      `SELECT i.category AS label, COUNT(*) AS items, SUM(i.amount) AS total
       FROM expense_item i
       JOIN reimbursement r ON r.reimbursement_id = i.reimbursement_id
       WHERE r.status <> 'REJECTED'
       GROUP BY i.category
       ORDER BY total DESC`,
    ),
    query(
      `SELECT DATE_FORMAT(claim_date, '%Y-%m') AS label, COUNT(*) AS claims, SUM(total_amount) AS total
       FROM reimbursement_summary
       WHERE status <> 'REJECTED'
       GROUP BY label
       ORDER BY label`,
    ),
    query(
      `SELECT status AS label, COUNT(*) AS claims, SUM(total_amount) AS total
       FROM reimbursement_summary
       GROUP BY status
       ORDER BY FIELD(status, 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED')`,
    ),
  ]);
  res.json({ byDepartment, byType, byCategory, byMonth, byStatus });
});

export default router;
