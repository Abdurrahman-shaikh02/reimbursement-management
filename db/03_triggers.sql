-- =============================================================================
-- Reimbursement Management System — 03_triggers.sql
-- Rules that a CHECK constraint cannot express, because they need the old row,
-- another row or another table [K1]. Each trigger raises SQLSTATE '45000' with a
-- readable message, which the application shows to the user as is.
--
--   T1  reimbursement   BEFORE INSERT/UPDATE   status workflow, frozen fields, approval limit
--   T2  expense_item    BEFORE INSERT/UPDATE/DELETE   items change only while SUBMITTED
--   T3  travel_/medical_/business_reimbursement BEFORE INSERT   details match claim_type
--   T4  employee        BEFORE INSERT/UPDATE   no self-supervision, no supervision cycles
--
-- Note: MySQL does not fire triggers for rows deleted by ON DELETE CASCADE.
-- =============================================================================
USE reimbursement_db;

DROP TRIGGER IF EXISTS trg_reimbursement_bi;
DROP TRIGGER IF EXISTS trg_reimbursement_bu;
DROP TRIGGER IF EXISTS trg_expense_item_bi;
DROP TRIGGER IF EXISTS trg_expense_item_bu;
DROP TRIGGER IF EXISTS trg_expense_item_bd;
DROP TRIGGER IF EXISTS trg_travel_bi;
DROP TRIGGER IF EXISTS trg_medical_bi;
DROP TRIGGER IF EXISTS trg_business_bi;
DROP TRIGGER IF EXISTS trg_employee_bi;
DROP TRIGGER IF EXISTS trg_employee_bu;
DROP PROCEDURE IF EXISTS check_item_change;
DROP PROCEDURE IF EXISTS check_claim_type;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- T1: the claim workflow (see the status diagram, Figure 3 of the report)
--   SUBMITTED → APPROVED | REJECTED,  APPROVED → PAID.  Nothing else.
-- -----------------------------------------------------------------------------

-- Every claim is born SUBMITTED. Without this, a claim could be inserted as
-- APPROVED and skip the approval-limit check below.
CREATE TRIGGER trg_reimbursement_bi
BEFORE INSERT ON reimbursement
FOR EACH ROW
BEGIN
    IF NEW.status <> 'SUBMITTED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new claim must start as SUBMITTED.';
    END IF;
END$$

CREATE TRIGGER trg_reimbursement_bu
BEFORE UPDATE ON reimbursement
FOR EACH ROW
BEGIN
    DECLARE v_items INT;
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_limit DECIMAL(12,2);
    DECLARE v_msg   VARCHAR(255);

    -- (b) who claimed, what type and when are fixed once the claim exists
    IF NEW.applicant_id <> OLD.applicant_id
       OR NEW.claim_type <> OLD.claim_type
       OR NEW.claim_date <> OLD.claim_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The applicant, type and date of a claim cannot be changed.';
    END IF;

    -- (b) a decision, once made, is never edited (<=> is the NULL-safe equality)
    IF OLD.status <> 'SUBMITTED'
       AND NOT (NEW.approved_by <=> OLD.approved_by
                AND NEW.approval_date <=> OLD.approval_date
                AND NEW.remarks <=> OLD.remarks) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A decision on a claim cannot be changed once it is made.';
    END IF;

    -- (a) only the moves drawn in the status diagram
    IF NEW.status <> OLD.status
       AND NOT ((OLD.status = 'SUBMITTED' AND NEW.status IN ('APPROVED', 'REJECTED'))
                OR (OLD.status = 'APPROVED' AND NEW.status = 'PAID')) THEN
        SET v_msg = CONCAT('A claim cannot move from ', OLD.status, ' to ', NEW.status, '.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;

    -- (c) approval: at least one item, and the total within the approver's limit [A10]
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'APPROVED' THEN
        SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_items, v_total
        FROM expense_item
        WHERE reimbursement_id = NEW.reimbursement_id;

        IF v_items = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A claim with no expense items cannot be approved.';
        END IF;

        SELECT approval_limit INTO v_limit
        FROM manager
        WHERE employee_id = NEW.approved_by;

        IF v_total > v_limit THEN
            SET v_msg = CONCAT('Claim total ', v_total, ' exceeds the approver''s limit of ', v_limit, '.');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
        END IF;
    END IF;
END$$

DELIMITER ;
