-- =====================================================================
-- Derived data: Total_Amount is a derived attribute in the ER diagram.
-- [E12][R7] It is computed when needed, never stored. Textbook §6.7.2
-- says derived attributes can be represented as functions; the function
-- below is the single definition used by the view, the triggers and
-- the application.
-- =====================================================================
USE rms;

DROP FUNCTION IF EXISTS claim_total;
DELIMITER $$
CREATE FUNCTION claim_total(p_reimbursement_id INT UNSIGNED)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(12,2);
    SELECT COALESCE(SUM(amount), 0) INTO v_total
      FROM expense_item
     WHERE reimbursement_id = p_reimbursement_id;
    RETURN v_total;
END$$
DELIMITER ;

-- One row per claim with the names the screens need and the derived total.
-- The aggregate runs once per query rather than once per claim (a correlated
-- call to claim_total), so list pages stay fast.
CREATE OR REPLACE VIEW reimbursement_summary AS
SELECT r.reimbursement_id,
       r.applicant_id,
       a.name                       AS applicant_name,
       d.dept_id,
       d.dept_name,
       r.claim_type,
       r.claim_date,
       r.status,
       COALESCE(t.total_amount, 0)  AS total_amount,
       COALESCE(t.item_count, 0)    AS item_count,
       r.reviewed_by,
       rv.name                      AS reviewer_name,
       r.review_date,
       r.remarks,
       r.paid_by,
       pb.name                      AS payer_name,
       r.payment_date,
       r.payment_ref
  FROM reimbursement r
  JOIN employee   a  ON a.employee_id = r.applicant_id
  JOIN department d  ON d.dept_id     = a.dept_id
  LEFT JOIN (SELECT reimbursement_id,
                    SUM(amount) AS total_amount,
                    COUNT(*)    AS item_count
               FROM expense_item
              GROUP BY reimbursement_id) t
         ON t.reimbursement_id = r.reimbursement_id
  LEFT JOIN employee rv ON rv.employee_id = r.reviewed_by
  LEFT JOIN employee pb ON pb.employee_id = r.paid_by;

-- Roles of every employee, read from the overlapping ISA tables.
CREATE OR REPLACE VIEW employee_roles AS
SELECT e.employee_id,
       (ap.employee_id IS NOT NULL) AS is_applicant,
       (m.employee_id  IS NOT NULL) AS is_manager,
       (ad.employee_id IS NOT NULL) AS is_admin,
       m.approval_limit
  FROM employee e
  LEFT JOIN applicant ap ON ap.employee_id = e.employee_id
  LEFT JOIN manager   m  ON m.employee_id  = e.employee_id
  LEFT JOIN admin     ad ON ad.employee_id = e.employee_id;
