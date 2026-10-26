-- =====================================================================
-- Constraint test suite: proves that the schema itself rejects bad data.
--
--   mysql -h127.0.0.1 -P3307 -uroot -p --protocol=TCP < db/06_constraint_tests.sql
--
-- Each test runs one statement. 'expect_error' tests must be rejected by
-- the database; 'expect_ok' tests must succeed. Everything runs inside
-- one transaction that is rolled back at the end, so the data is
-- unchanged afterwards. Good for a live demonstration in the viva.
-- =====================================================================
USE rms;

DROP PROCEDURE IF EXISTS expect_error;
DROP PROCEDURE IF EXISTS expect_ok;

DELIMITER $$
CREATE PROCEDURE expect_error(IN p_rule VARCHAR(120), IN p_sql TEXT)
BEGIN
    DECLARE v_msg TEXT DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
    SET @stmt = p_sql;
    PREPARE s FROM @stmt;
    EXECUTE s;
    DEALLOCATE PREPARE s;
    INSERT INTO test_results (rule_tested, expected, result, db_message)
    VALUES (p_rule, 'rejected', IF(v_msg IS NULL, 'FAIL', 'pass'), COALESCE(v_msg, '(statement was accepted)'));
END$$

CREATE PROCEDURE expect_ok(IN p_rule VARCHAR(120), IN p_sql TEXT)
BEGIN
    DECLARE v_msg TEXT DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
    SET @stmt = p_sql;
    PREPARE s FROM @stmt;
    EXECUTE s;
    DEALLOCATE PREPARE s;
    INSERT INTO test_results (rule_tested, expected, result, db_message)
    VALUES (p_rule, 'accepted', IF(v_msg IS NULL, 'pass', 'FAIL'), COALESCE(v_msg, '-'));
END$$
DELIMITER ;

-- MEMORY engine is non-transactional, so the results survive the ROLLBACK.
CREATE TEMPORARY TABLE test_results (
    test_no     INT AUTO_INCREMENT PRIMARY KEY,
    rule_tested VARCHAR(120),
    expected    VARCHAR(10),
    result      VARCHAR(4),
    db_message  VARCHAR(300)
) ENGINE = MEMORY;

START TRANSACTION;

-- ---------- Domain constraints (CHECK) ----------
CALL expect_error('Amount must be positive',
    "INSERT INTO expense_item VALUES (21, 9, 'MEALS', 'Refund', -50, '2026-10-06', NULL)");
CALL expect_error('Category must be from the fixed list',
    "INSERT INTO expense_item VALUES (21, 9, 'GADGETS', 'Headphones', 500, '2026-10-06', NULL)");
CALL expect_error('Status must be one of the four lifecycle values',
    "UPDATE reimbursement SET status = 'ON_HOLD' WHERE reimbursement_id = 21");
CALL expect_error('IFSC code must be upper-case and well-formed',
    "UPDATE applicant SET ifsc_code = 'hdfc0001234' WHERE employee_id = 5");
CALL expect_error('Phone number must be 10 to 14 digits',
    "INSERT INTO employee_phone VALUES (11, '12345')");
CALL expect_error('Treatment type must be from the fixed list',
    "UPDATE medical_reimbursement SET treatment_type = 'SPA' WHERE reimbursement_id = 22");

-- ---------- Keys (PRIMARY KEY / UNIQUE) ----------
CALL expect_error('Email is a candidate key (UNIQUE)',
    "INSERT INTO employee (name, email, password_hash, designation, date_of_joining, dept_id)
     VALUES ('Copy', 'anita.desai@rms.example', REPEAT('x', 60), 'Clerk', '2026-01-01', 1)");
CALL expect_error('(IFSC, account no) is a candidate key (UNIQUE)',
    "UPDATE applicant SET ifsc_code = 'HDFC0001234', bank_account_no = '50100234567801' WHERE employee_id = 5");
CALL expect_error('Item number is unique within a claim (weak entity key)',
    "INSERT INTO expense_item VALUES (21, 1, 'MEALS', 'Duplicate number', 100, '2026-10-06', NULL)");

-- ---------- Referential integrity (FOREIGN KEY) ----------
CALL expect_error('Only an APPLICANT can submit a claim',
    "INSERT INTO reimbursement (applicant_id, claim_type) VALUES (10, 'TRAVEL')");
CALL expect_error('Only a MANAGER can review a claim',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 7, review_date = CURRENT_DATE WHERE reimbursement_id = 25");
CALL expect_error('Disjoint ISA: a TRAVEL claim cannot get MEDICAL details',
    "INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type) VALUES (21, 'City Care Hospital', 'OTHER')");
CALL expect_error('A claim has at most one details row (PK of the subclass table)',
    "INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km) VALUES (21, 'Pune', 'Nashik', 210)");
CALL expect_error('A claim''s type cannot change after submission',
    "UPDATE reimbursement SET claim_type = 'MEDICAL' WHERE reimbursement_id = 21");
CALL expect_error('A department with employees cannot be deleted',
    "DELETE FROM department WHERE dept_id = 1");
CALL expect_error('An employee with claims on record cannot be deleted',
    "DELETE FROM employee WHERE employee_id = 5");

-- ---------- Lifecycle and separation of duties (multi-column CHECK) ----------
CALL expect_error('A manager cannot review their own claim',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = CURRENT_DATE WHERE reimbursement_id = 24");
CALL expect_error('A rejection must carry remarks',
    "UPDATE reimbursement SET status = 'REJECTED', reviewed_by = 2, review_date = CURRENT_DATE WHERE reimbursement_id = 25");
CALL expect_error('APPROVED requires a reviewer and a review date',
    "UPDATE reimbursement SET status = 'APPROVED' WHERE reimbursement_id = 25");

-- Setup for the payment tests: Sneha (admin) files a claim and it is approved.
CALL expect_ok('Setup: an admin files a medical claim',
    "INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type) VALUES (900, 4, 'MEDICAL')");
CALL expect_ok('Setup: add its medical details',
    "INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type) VALUES (900, 'City Care Hospital', 'CONSULTATION')");
CALL expect_ok('Setup: add one expense item',
    "INSERT INTO expense_item VALUES (900, 1, 'MEDICAL', 'Consultation fee', 700, CURRENT_DATE, NULL)");
CALL expect_ok('A manager approves a claim within their limit',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = CURRENT_DATE WHERE reimbursement_id = 900");
CALL expect_error('An admin cannot pay their own claim',
    "UPDATE reimbursement SET status = 'PAID', paid_by = 4, payment_date = CURRENT_DATE, payment_ref = 'UTRTEST0001' WHERE reimbursement_id = 900");
CALL expect_error('A payment reference (UTR) is unique',
    "UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = CURRENT_DATE, payment_ref = 'UTR260515000101' WHERE reimbursement_id = 900");

-- Setup: make Meera (admin) a manager too, so one person could do both steps.
CALL expect_ok('Setup: Meera also becomes a manager',
    "INSERT INTO manager (employee_id, approval_limit) VALUES (10, 20000)");
CALL expect_ok('Setup: Meera approves claim 25',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 10, review_date = CURRENT_DATE WHERE reimbursement_id = 25");
CALL expect_error('The payer cannot be the person who approved the claim',
    "UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = CURRENT_DATE, payment_ref = 'UTRTEST0002' WHERE reimbursement_id = 25");

-- ---------- Triggers ----------
CALL expect_error('Approval limit: 57,500 claim vs a 50,000 limit',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 2, review_date = CURRENT_DATE WHERE reimbursement_id = 26");
CALL expect_error('A claim cannot jump from SUBMITTED to PAID',
    "UPDATE reimbursement SET status = 'PAID', reviewed_by = 1, review_date = CURRENT_DATE, paid_by = 4, payment_date = CURRENT_DATE, payment_ref = 'UTRTEST0003' WHERE reimbursement_id = 27");
CALL expect_error('A rejected claim is closed',
    "UPDATE reimbursement SET remarks = 'Changed my mind' WHERE reimbursement_id = 6");
CALL expect_error('An approved claim can only move to PAID',
    "UPDATE reimbursement SET status = 'REJECTED', remarks = 'Reversed' WHERE reimbursement_id = 18");
CALL expect_error('A new claim must start as SUBMITTED',
    "INSERT INTO reimbursement (applicant_id, claim_type, status, reviewed_by, review_date) VALUES (5, 'TRAVEL', 'APPROVED', 2, CURRENT_DATE)");
CALL expect_error('Claim date cannot be in the future',
    "INSERT INTO reimbursement (applicant_id, claim_type, claim_date) VALUES (5, 'TRAVEL', CURRENT_DATE + INTERVAL 1 DAY)");
CALL expect_error('An expense cannot be dated after its claim',
    "INSERT INTO expense_item VALUES (21, 9, 'MEALS', 'Late dinner', 300, '2026-10-09', NULL)");
CALL expect_error('Expense items are frozen after review',
    "UPDATE expense_item SET amount = 1 WHERE reimbursement_id = 1 AND item_no = 1");
CALL expect_error('A claim keeps at least one expense item',
    "DELETE FROM expense_item WHERE reimbursement_id = 27 AND item_no = 1");
CALL expect_error('An expense item cannot move to another claim',
    "UPDATE expense_item SET reimbursement_id = 22 WHERE reimbursement_id = 21 AND item_no = 1");
CALL expect_error('Claim details cannot be deleted on their own',
    "DELETE FROM travel_reimbursement WHERE reimbursement_id = 21");
CALL expect_error('Only unreviewed claims can be withdrawn',
    "DELETE FROM reimbursement WHERE reimbursement_id = 1");
CALL expect_error('Supervision cannot form a cycle (Rahul under Vikram)',
    "UPDATE employee SET supervisor_id = 5 WHERE employee_id = 2");
CALL expect_error('An employee cannot supervise themselves',
    "UPDATE employee SET supervisor_id = 5 WHERE employee_id = 5");

-- Totality gates: a claim missing its items or its details cannot be reviewed.
CALL expect_ok('Setup: a travel claim with details but no items',
    "INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type) VALUES (901, 5, 'TRAVEL')");
CALL expect_ok('Setup: its travel details',
    "INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km) VALUES (901, 'Pune', 'Satara', 110)");
CALL expect_error('A claim with no expense items cannot be reviewed',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 2, review_date = CURRENT_DATE WHERE reimbursement_id = 901");
CALL expect_ok('Setup: a medical claim with an item but no details',
    "INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type) VALUES (902, 5, 'MEDICAL')");
CALL expect_ok('Setup: its expense item',
    "INSERT INTO expense_item VALUES (902, 1, 'MEDICAL', 'Medicines', 400, CURRENT_DATE, NULL)");
CALL expect_error('A claim with no details row cannot be reviewed',
    "UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 2, review_date = CURRENT_DATE WHERE reimbursement_id = 902");

-- ---------- Cascades ----------
CALL expect_ok('Withdrawing a submitted claim removes its items and details (CASCADE)',
    "DELETE FROM reimbursement WHERE reimbursement_id = 27");
INSERT INTO test_results (rule_tested, expected, result, db_message)
SELECT 'Cascade check: claim 27 left no orphan rows', '0 rows',
       IF(COUNT(*) = 0, 'pass', 'FAIL'), CONCAT(COUNT(*), ' orphan rows')
  FROM (SELECT reimbursement_id FROM expense_item WHERE reimbursement_id = 27
        UNION ALL
        SELECT reimbursement_id FROM travel_reimbursement WHERE reimbursement_id = 27) x;

ROLLBACK;

-- AUTO_INCREMENT counters are not transactional: the rolled-back inserts
-- above still advanced them. Setting the counter to 1 makes InnoDB use
-- MAX(id) + 1, so the next real claim gets the next number.
ALTER TABLE reimbursement AUTO_INCREMENT = 1;
ALTER TABLE employee AUTO_INCREMENT = 1;

SELECT test_no, result, rule_tested, db_message FROM test_results ORDER BY test_no;
SELECT SUM(result = 'pass') AS passed, SUM(result = 'FAIL') AS failed FROM test_results;

DROP TEMPORARY TABLE test_results;
DROP PROCEDURE expect_error;
DROP PROCEDURE expect_ok;
