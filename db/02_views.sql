-- The derived attribute total_amount of REIMBURSEMENT, computed from the items
-- instead of being stored. A claim with no items shows 0.
USE reimbursement_db;

CREATE OR REPLACE VIEW reimbursement_summary AS
SELECT r.reimbursement_id,
       r.applicant_id,
       r.claim_type,
       r.claim_date,
       r.status,
       r.approved_by,
       r.approval_date,
       r.remarks,
       COALESCE(t.total_amount, 0) AS total_amount,
       COALESCE(t.item_count, 0)   AS item_count
FROM reimbursement r
LEFT JOIN (                                   -- LEFT JOIN keeps claims that have no items yet
    SELECT reimbursement_id,
           SUM(amount) AS total_amount,
           COUNT(*)    AS item_count
    FROM expense_item
    GROUP BY reimbursement_id
) t ON t.reimbursement_id = r.reimbursement_id;
