-- =====================================================================
-- Queries behind the Reports and queue screens, for running by hand.
-- Each one names the SQL features it shows (textbook chapter in brackets).
-- =====================================================================
USE rms;

-- 1. Derived attribute: total of one claim through the function (Ch 5.2)
SELECT claim_total(16) AS total_of_claim_16;

-- 2. Claims by status (aggregation with grouping, Ch 3.7)
SELECT status, COUNT(*) AS claims, SUM(total_amount) AS amount
  FROM reimbursement_summary
 GROUP BY status;

-- 3. Approved spend by department (join through the view, Ch 4.1 and 4.2)
SELECT dept_name, COUNT(*) AS claims, SUM(total_amount) AS amount
  FROM reimbursement_summary
 WHERE status IN ('APPROVED', 'PAID')
 GROUP BY dept_name
 ORDER BY amount DESC;

-- 4. Spend by claim type, with the average claim (aggregation)
SELECT claim_type, COUNT(*) AS claims, SUM(total_amount) AS amount,
       ROUND(AVG(total_amount), 2) AS average
  FROM reimbursement_summary
 WHERE status IN ('APPROVED', 'PAID')
 GROUP BY claim_type;

-- 5. Monthly trend: conditional aggregation with CASE (Ch 3.7)
SELECT DATE_FORMAT(claim_date, '%Y-%m') AS month,
       COUNT(*) AS claims,
       SUM(CASE WHEN status IN ('APPROVED', 'PAID') THEN total_amount ELSE 0 END) AS approved_amount,
       SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) AS paid_amount
  FROM reimbursement_summary
 GROUP BY month
 ORDER BY month;

-- 6. Top claimants, ranked with a window function (Ch 5.5)
SELECT applicant_name, dept_name, claims, amount,
       RANK() OVER (ORDER BY amount DESC) AS spend_rank
  FROM (SELECT applicant_name, dept_name, COUNT(*) AS claims, SUM(total_amount) AS amount
          FROM reimbursement_summary
         WHERE status IN ('APPROVED', 'PAID')
         GROUP BY applicant_id, applicant_name, dept_name) t;

-- 7. The reporting hierarchy over SUPERVISES (recursive query, Ch 5.4)
WITH RECURSIVE org (employee_id, name, level, path) AS (
    SELECT employee_id, name, 0, CAST(name AS CHAR(500))
      FROM employee
     WHERE supervisor_id IS NULL
    UNION ALL
    SELECT e.employee_id, e.name, o.level + 1, CONCAT(o.path, ' > ', e.name)
      FROM employee e
      JOIN org o ON e.supervisor_id = o.employee_id
)
SELECT employee_id, CONCAT(REPEAT('    ', level), name) AS employee, path
  FROM org
 ORDER BY path;

-- 8. A manager's review queue: claims they may decide (here Neha, id 6)
SELECT s.reimbursement_id, s.applicant_name, s.total_amount
  FROM reimbursement_summary s
 WHERE s.status = 'SUBMITTED'
   AND s.applicant_id <> 6
   AND s.total_amount <= (SELECT approval_limit FROM manager WHERE employee_id = 6);

-- 9. Overlapping specialization: employees holding more than one role
SELECT e.name, r.is_applicant, r.is_manager, r.is_admin
  FROM employee e
  JOIN employee_roles r ON r.employee_id = e.employee_id
 WHERE r.is_applicant + r.is_manager + r.is_admin > 1;

-- 10. Partial specialization: employees in no subclass at all
SELECT e.name, e.designation
  FROM employee e
 WHERE NOT EXISTS (SELECT 1 FROM applicant a WHERE a.employee_id = e.employee_id)
   AND NOT EXISTS (SELECT 1 FROM manager   m WHERE m.employee_id = e.employee_id)
   AND NOT EXISTS (SELECT 1 FROM admin     d WHERE d.employee_id = e.employee_id);

-- 11. Integrity audit: every claim has exactly one details row of its own
--     type and at least one item. Should return no rows.
SELECT r.reimbursement_id, r.claim_type,
       (SELECT COUNT(*) FROM travel_reimbursement   t WHERE t.reimbursement_id = r.reimbursement_id)
     + (SELECT COUNT(*) FROM medical_reimbursement  m WHERE m.reimbursement_id = r.reimbursement_id)
     + (SELECT COUNT(*) FROM business_reimbursement b WHERE b.reimbursement_id = r.reimbursement_id) AS detail_rows,
       (SELECT COUNT(*) FROM expense_item i WHERE i.reimbursement_id = r.reimbursement_id) AS items
  FROM reimbursement r
HAVING detail_rows <> 1 OR items = 0;
