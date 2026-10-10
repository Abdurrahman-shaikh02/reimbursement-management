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

-- -----------------------------------------------------------------------------
-- T2: expense items are frozen once a manager has decided, otherwise the
-- approved total could change afterwards. Also expense_date ≤ claim_date.
-- One procedure, called from the three item triggers.
-- -----------------------------------------------------------------------------
CREATE PROCEDURE check_item_change(IN p_reimbursement_id INT, IN p_expense_date DATE)
BEGIN
    DECLARE v_status     VARCHAR(10);
    DECLARE v_claim_date DATE;

    SELECT status, claim_date INTO v_status, v_claim_date
    FROM reimbursement
    WHERE reimbursement_id = p_reimbursement_id;

    -- v_status is NULL if the claim does not exist; the foreign key reports that case
    IF v_status IS NOT NULL AND v_status <> 'SUBMITTED' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Expense items can be changed only while the claim is SUBMITTED.';
    END IF;

    IF p_expense_date IS NOT NULL AND p_expense_date > v_claim_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An expense cannot be dated after the claim date.';
    END IF;
END$$

CREATE TRIGGER trg_expense_item_bi
BEFORE INSERT ON expense_item
FOR EACH ROW
BEGIN
    CALL check_item_change(NEW.reimbursement_id, NEW.expense_date);
END$$

CREATE TRIGGER trg_expense_item_bu
BEFORE UPDATE ON expense_item
FOR EACH ROW
BEGIN
    IF NEW.reimbursement_id <> OLD.reimbursement_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An expense item cannot be moved to another claim.';
    END IF;
    CALL check_item_change(NEW.reimbursement_id, NEW.expense_date);
END$$

CREATE TRIGGER trg_expense_item_bd
BEFORE DELETE ON expense_item
FOR EACH ROW
BEGIN
    CALL check_item_change(OLD.reimbursement_id, NULL);
END$$

-- -----------------------------------------------------------------------------
-- T3: disjointness of the claim specialization [S2]. A details row may only be
-- added to a claim of the matching type, so no claim has two kinds of details.
-- -----------------------------------------------------------------------------
CREATE PROCEDURE check_claim_type(IN p_reimbursement_id INT, IN p_expected VARCHAR(10))
BEGIN
    DECLARE v_type VARCHAR(10);
    DECLARE v_msg  VARCHAR(255);

    SELECT claim_type INTO v_type
    FROM reimbursement
    WHERE reimbursement_id = p_reimbursement_id;

    IF v_type IS NOT NULL AND v_type <> p_expected THEN
        SET v_msg = CONCAT('Claim ', p_reimbursement_id, ' is a ', v_type,
                           ' claim; it cannot have ', p_expected, ' details.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

CREATE TRIGGER trg_travel_bi
BEFORE INSERT ON travel_reimbursement
FOR EACH ROW
BEGIN
    CALL check_claim_type(NEW.reimbursement_id, 'TRAVEL');
END$$

CREATE TRIGGER trg_medical_bi
BEFORE INSERT ON medical_reimbursement
FOR EACH ROW
BEGIN
    CALL check_claim_type(NEW.reimbursement_id, 'MEDICAL');
END$$

CREATE TRIGGER trg_business_bi
BEFORE INSERT ON business_reimbursement
FOR EACH ROW
BEGIN
    CALL check_claim_type(NEW.reimbursement_id, 'BUSINESS');
END$$

-- -----------------------------------------------------------------------------
-- T4: SUPERVISES must stay a tree [R2].
-- On INSERT the new row has no subordinates yet, so only a self-reference
-- (possible when an explicit employee_id is given) needs checking.
-- On UPDATE, walk up from the new supervisor; reaching this employee means a cycle.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_employee_bi
BEFORE INSERT ON employee
FOR EACH ROW
BEGIN
    IF NEW.supervisor_id IS NOT NULL AND NEW.supervisor_id = NEW.employee_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An employee cannot supervise themselves.';
    END IF;
END$$

CREATE TRIGGER trg_employee_bu
BEFORE UPDATE ON employee
FOR EACH ROW
BEGIN
    IF NEW.supervisor_id IS NOT NULL AND NEW.supervisor_id = NEW.employee_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An employee cannot supervise themselves.';
    END IF;

    IF NEW.supervisor_id IS NOT NULL AND NOT (NEW.supervisor_id <=> OLD.supervisor_id) THEN
        IF EXISTS (
            WITH RECURSIVE chain (id) AS (
                SELECT NEW.supervisor_id
                UNION ALL
                SELECT e.supervisor_id
                FROM employee e
                JOIN chain c ON e.employee_id = c.id
                WHERE e.supervisor_id IS NOT NULL
            )
            SELECT 1 FROM chain WHERE id = NEW.employee_id
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'This supervisor reports (directly or indirectly) to the employee: that would be a cycle.';
        END IF;
    END IF;
END$$

DELIMITER ;
