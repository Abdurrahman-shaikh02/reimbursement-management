import { Router } from 'express';
import { query } from '../db.js';

export const reportsRouter = Router();

// The same queries, with commentary, are in db/07_report_queries.sql.
reportsRouter.get('/', async (req, res) => {
  const [byStatus, byDepartment, byType, byMonth, byCategory, topClaimants, hierarchy] = await Promise.all([
    query(
      `SELECT status, COUNT(*) AS claims, SUM(total_amount) AS amount
         FROM reimbursement_summary
        GROUP BY status
        ORDER BY FIELD(status, 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID')`,
    ),
    // Only approved or paid claims count as spend.
    query(
      `SELECT dept_name, COUNT(*) AS claims, SUM(total_amount) AS amount
         FROM reimbursement_summary
        WHERE status IN ('APPROVED', 'PAID')
        GROUP BY dept_name
        ORDER BY amount DESC`,
    ),
    query(
      `SELECT claim_type, COUNT(*) AS claims, SUM(total_amount) AS amount,
              ROUND(AVG(total_amount), 2) AS average
         FROM reimbursement_summary
        WHERE status IN ('APPROVED', 'PAID')
        GROUP BY claim_type
        ORDER BY amount DESC`,
    ),
    query(
      `SELECT DATE_FORMAT(claim_date, '%Y-%m') AS month,
              COUNT(*) AS claims,
              SUM(CASE WHEN status IN ('APPROVED', 'PAID') THEN total_amount ELSE 0 END) AS approved_amount,
              SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) AS paid_amount
         FROM reimbursement_summary
        GROUP BY month
        ORDER BY month`,
    ),
    query(
      `SELECT i.category, COUNT(*) AS items, SUM(i.amount) AS amount
         FROM expense_item i
         JOIN reimbursement r ON r.reimbursement_id = i.reimbursement_id
        WHERE r.status IN ('APPROVED', 'PAID')
        GROUP BY i.category
        ORDER BY amount DESC`,
    ),
    // Window function: rank applicants by approved spend.
    query(
      `SELECT applicant_name, dept_name, claims, amount,
              RANK() OVER (ORDER BY amount DESC) AS spend_rank
         FROM (SELECT applicant_name, dept_name, COUNT(*) AS claims, SUM(total_amount) AS amount
                 FROM reimbursement_summary
                WHERE status IN ('APPROVED', 'PAID')
                GROUP BY applicant_id, applicant_name, dept_name) t
        ORDER BY spend_rank
        LIMIT 5`,
    ),
    // Recursive query over SUPERVISES: the reporting tree, depth first.
    query(
      `WITH RECURSIVE org (employee_id, name, designation, level, path) AS (
           SELECT employee_id, name, designation, 0, CAST(LPAD(employee_id, 4, '0') AS CHAR(400))
             FROM employee
            WHERE supervisor_id IS NULL
           UNION ALL
           SELECT e.employee_id, e.name, e.designation, o.level + 1,
                  CONCAT(o.path, '/', LPAD(e.employee_id, 4, '0'))
             FROM employee e
             JOIN org o ON e.supervisor_id = o.employee_id
       )
       SELECT employee_id, name, designation, level FROM org ORDER BY path`,
    ),
  ]);
  res.json({ byStatus, byDepartment, byType, byMonth, byCategory, topClaimants, hierarchy });
});
