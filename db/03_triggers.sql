-- =====================================================================
-- Triggers: rules that a CHECK constraint cannot express  [C7]
--
-- A MySQL CHECK can only see the columns of the row being written and
-- cannot call non-deterministic functions such as CURRENT_DATE.
-- Every rule below either reads another row/table or needs today's date.
--
-- Note: cascaded foreign-key deletes do not fire triggers in MySQL.
-- The delete-blocking triggers on child tables rely on this: they stop
-- direct deletes but still let a whole claim be withdrawn by deleting
-- its reimbursement row.
-- =====================================================================
USE rms;

DROP PROCEDURE IF EXISTS assert_claim_editable;
DROP PROCEDURE IF EXISTS assert_claim_type;
DROP TRIGGER IF EXISTS trg_travel_bi;
DROP TRIGGER IF EXISTS trg_medical_bi;
DROP TRIGGER IF EXISTS trg_business_bi;
DROP TRIGGER IF EXISTS trg_employee_bi;
DROP TRIGGER IF EXISTS trg_employee_bu;
DROP TRIGGER IF EXISTS trg_reimbursement_bi;
DROP TRIGGER IF EXISTS trg_reimbursement_bu;
DROP TRIGGER IF EXISTS trg_reimbursement_bd;
DROP TRIGGER IF EXISTS trg_expense_item_bi;
DROP TRIGGER IF EXISTS trg_expense_item_bu;
DROP TRIGGER IF EXISTS trg_expense_item_bd;
DROP TRIGGER IF EXISTS trg_travel_bu;
DROP TRIGGER IF EXISTS trg_travel_bd;
DROP TRIGGER IF EXISTS trg_medical_bu;
DROP TRIGGER IF EXISTS trg_medical_bd;
DROP TRIGGER IF EXISTS trg_business_bu;
DROP TRIGGER IF EXISTS trg_business_bd;

DELIMITER $$

-- [C9] A claim's details are frozen once a manager has reviewed it.
-- Shared by the expense-item and claim-detail triggers.
CREATE PROCEDURE assert_claim_editable(IN p_reimbursement_id INT UNSIGNED)
READS SQL DATA
BEGIN
    DECLARE v_status VARCHAR(9);
    SELECT status INTO v_status
      FROM reimbursement
     WHERE reimbursement_id = p_reimbursement_id;
    IF v_status IS NOT NULL AND v_status <> 'SUBMITTED' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Claim details cannot change after the claim has been reviewed';
    END IF;
END$$

-- [R8] Disjoint specialization: a claim's details may only go in the table
-- that matches its claim_type. Together with the primary key of each
-- details table and trg_reimbursement_bu (claim_type never changes), a
-- claim can have at most one details row, of the right type.
CREATE PROCEDURE assert_claim_type(IN p_reimbursement_id INT UNSIGNED, IN p_expected VARCHAR(8))
READS SQL DATA
BEGIN
    DECLARE v_type VARCHAR(8);
    SELECT claim_type INTO v_type
      FROM reimbursement
     WHERE reimbursement_id = p_reimbursement_id;
    IF v_type IS NOT NULL AND v_type <> p_expected THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'These details do not match the claim type (specialization is disjoint)';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- EMPLOYEE: the SUPERVISES hierarchy must stay a tree  [C10]
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_employee_bi
BEFORE INSERT ON employee
FOR EACH ROW
BEGIN
    -- A new employee has no subordinates yet, so the only possible cycle
    -- is a self-loop (when the id is supplied explicitly).
    IF NEW.supervisor_id IS NOT NULL AND NEW.supervisor_id = NEW.employee_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An employee cannot supervise themselves';
    END IF;
END$$

CREATE TRIGGER trg_employee_bu
BEFORE UPDATE ON employee
FOR EACH ROW
BEGIN
    DECLARE v_cycle INT DEFAULT 0;

    IF NEW.supervisor_id IS NOT NULL AND NOT (NEW.supervisor_id <=> OLD.supervisor_id) THEN
        IF NEW.supervisor_id = NEW.employee_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An employee cannot supervise themselves';
        END IF;

        -- Walk up the chain from the proposed supervisor (textbook §5.4,
        -- recursive queries). Reaching this employee means a cycle.
        WITH RECURSIVE chain (emp_id) AS (
            SELECT NEW.supervisor_id
            UNION ALL
            SELECT e.supervisor_id
              FROM employee e
              JOIN chain c ON e.employee_id = c.emp_id
             WHERE e.supervisor_id IS NOT NULL
        )
        SELECT COUNT(*) INTO v_cycle FROM chain WHERE emp_id = NEW.employee_id;

        IF v_cycle > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'This supervisor assignment would create a cycle in the hierarchy';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- REIMBURSEMENT: lifecycle, authority limit, totality gates
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_reimbursement_bi
BEFORE INSERT ON reimbursement
FOR EACH ROW
BEGIN
    IF NEW.status <> 'SUBMITTED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new claim must start in status SUBMITTED';
    END IF;
    IF NEW.claim_date > CURRENT_DATE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim date cannot be in the future';
    END IF;
END$$

CREATE TRIGGER trg_reimbursement_bu
BEFORE UPDATE ON reimbursement
FOR EACH ROW
BEGIN
    DECLARE v_total   DECIMAL(12,2);
    DECLARE v_limit   DECIMAL(12,2);
    DECLARE v_details INT;
    DECLARE v_msg     VARCHAR(128);

    -- The identity of a claim never changes.
    IF NEW.applicant_id <> OLD.applicant_id
       OR NEW.claim_type <> OLD.claim_type
       OR NEW.claim_date <> OLD.claim_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Applicant, claim type and claim date cannot change after submission';
    END IF;

    -- [E11] Allowed transitions:
    --   SUBMITTED -> APPROVED | REJECTED,   APPROVED -> PAID
    -- REJECTED and PAID are final.
    IF OLD.status IN ('REJECTED', 'PAID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This claim is closed and can no longer be changed';
    END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'PAID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An approved claim can only move to PAID';
    END IF;
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'PAID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A claim must be approved before it is paid';
    END IF;

    -- Review: SUBMITTED -> APPROVED | REJECTED
    IF OLD.status = 'SUBMITTED' AND NEW.status IN ('APPROVED', 'REJECTED') THEN
        -- [C8] MySQL has no deferred constraints, so the two "total
        -- participation" rules cannot be checked at insert time. They are
        -- checked here instead: no claim can be reviewed without them.
        IF NOT EXISTS (SELECT 1 FROM expense_item
                        WHERE reimbursement_id = NEW.reimbursement_id) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A claim needs at least one expense item before it can be reviewed';
        END IF;

        SET v_details = CASE NEW.claim_type
            WHEN 'TRAVEL'   THEN (SELECT COUNT(*) FROM travel_reimbursement
                                   WHERE reimbursement_id = NEW.reimbursement_id)
            WHEN 'MEDICAL'  THEN (SELECT COUNT(*) FROM medical_reimbursement
                                   WHERE reimbursement_id = NEW.reimbursement_id)
            WHEN 'BUSINESS' THEN (SELECT COUNT(*) FROM business_reimbursement
                                   WHERE reimbursement_id = NEW.reimbursement_id)
        END;
        IF v_details = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'The claim has no details row for its claim type';
        END IF;

        -- [E17] A manager may only decide claims within their approval limit.
        SET v_total = claim_total(NEW.reimbursement_id);
        SELECT approval_limit INTO v_limit
          FROM manager
         WHERE employee_id = NEW.reviewed_by;
        IF v_total > v_limit THEN
            SET v_msg = CONCAT('Claim total ', v_total,
                               ' exceeds the reviewer''s approval limit of ', v_limit);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
        END IF;

        IF NEW.review_date > CURRENT_DATE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review date cannot be in the future';
        END IF;
    END IF;

    -- Payment: APPROVED -> PAID
    IF OLD.status = 'APPROVED' AND NEW.status = 'PAID' THEN
        IF NOT (NEW.reviewed_by <=> OLD.reviewed_by)
           OR NOT (NEW.review_date <=> OLD.review_date)
           OR NOT (NEW.remarks <=> OLD.remarks) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'The review of a claim cannot change when it is paid';
        END IF;
        IF NEW.payment_date > CURRENT_DATE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment date cannot be in the future';
        END IF;
    END IF;
END$$

-- Withdrawing a claim = deleting it; only possible before review.
CREATE TRIGGER trg_reimbursement_bd
BEFORE DELETE ON reimbursement
FOR EACH ROW
BEGIN
    IF OLD.status <> 'SUBMITTED' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only claims that have not been reviewed can be withdrawn';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- EXPENSE_ITEM
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_expense_item_bi
BEFORE INSERT ON expense_item
FOR EACH ROW
BEGIN
    DECLARE v_claim_date DATE;

    CALL assert_claim_editable(NEW.reimbursement_id);

    SELECT claim_date INTO v_claim_date
      FROM reimbursement
     WHERE reimbursement_id = NEW.reimbursement_id;
    IF NEW.expense_date > v_claim_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An expense cannot be dated after the claim date';
    END IF;
END$$

CREATE TRIGGER trg_expense_item_bu
BEFORE UPDATE ON expense_item
FOR EACH ROW
BEGIN
    DECLARE v_claim_date DATE;

    -- A weak entity's identity (owner + discriminator) is fixed.
    IF NEW.reimbursement_id <> OLD.reimbursement_id OR NEW.item_no <> OLD.item_no THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An expense item cannot be moved or renumbered';
    END IF;

    CALL assert_claim_editable(OLD.reimbursement_id);

    SELECT claim_date INTO v_claim_date
      FROM reimbursement
     WHERE reimbursement_id = NEW.reimbursement_id;
    IF NEW.expense_date > v_claim_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An expense cannot be dated after the claim date';
    END IF;
END$$

CREATE TRIGGER trg_expense_item_bd
BEFORE DELETE ON expense_item
FOR EACH ROW
BEGIN
    DECLARE v_items INT;

    CALL assert_claim_editable(OLD.reimbursement_id);

    -- [E13] REIMBURSEMENT participates totally in CONTAINS (1..*).
    SELECT COUNT(*) INTO v_items
      FROM expense_item
     WHERE reimbursement_id = OLD.reimbursement_id;
    IF v_items <= 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A claim must keep at least one expense item; withdraw the claim instead';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Claim-type detail tables: only for claims of that type (disjoint),
-- editable only before review, and removable only together with their
-- claim (keeps the specialization total).
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_travel_bi
BEFORE INSERT ON travel_reimbursement
FOR EACH ROW
BEGIN
    CALL assert_claim_type(NEW.reimbursement_id, 'TRAVEL');
    CALL assert_claim_editable(NEW.reimbursement_id);
END$$

CREATE TRIGGER trg_medical_bi
BEFORE INSERT ON medical_reimbursement
FOR EACH ROW
BEGIN
    CALL assert_claim_type(NEW.reimbursement_id, 'MEDICAL');
    CALL assert_claim_editable(NEW.reimbursement_id);
END$$

CREATE TRIGGER trg_business_bi
BEFORE INSERT ON business_reimbursement
FOR EACH ROW
BEGIN
    CALL assert_claim_type(NEW.reimbursement_id, 'BUSINESS');
    CALL assert_claim_editable(NEW.reimbursement_id);
END$$

CREATE TRIGGER trg_travel_bu
BEFORE UPDATE ON travel_reimbursement
FOR EACH ROW
BEGIN
    IF NEW.reimbursement_id <> OLD.reimbursement_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim details cannot move to another claim';
    END IF;
    CALL assert_claim_editable(OLD.reimbursement_id);
END$$

CREATE TRIGGER trg_travel_bd
BEFORE DELETE ON travel_reimbursement
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Claim details can only be removed by withdrawing the whole claim';
END$$

CREATE TRIGGER trg_medical_bu
BEFORE UPDATE ON medical_reimbursement
FOR EACH ROW
BEGIN
    IF NEW.reimbursement_id <> OLD.reimbursement_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim details cannot move to another claim';
    END IF;
    CALL assert_claim_editable(OLD.reimbursement_id);
END$$

CREATE TRIGGER trg_medical_bd
BEFORE DELETE ON medical_reimbursement
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Claim details can only be removed by withdrawing the whole claim';
END$$

CREATE TRIGGER trg_business_bu
BEFORE UPDATE ON business_reimbursement
FOR EACH ROW
BEGIN
    IF NEW.reimbursement_id <> OLD.reimbursement_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim details cannot move to another claim';
    END IF;
    CALL assert_claim_editable(OLD.reimbursement_id);
END$$

CREATE TRIGGER trg_business_bd
BEFORE DELETE ON business_reimbursement
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Claim details can only be removed by withdrawing the whole claim';
END$$

DELIMITER ;
