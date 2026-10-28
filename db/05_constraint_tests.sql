-- Tests the keys, foreign keys and CHECK constraints with invalid data.
-- Prints one row per test. Everything is rolled back at the end.
--
--   mysql -h 127.0.0.1 -P 3307 -u root -p reimbursement_db < db/05_constraint_tests.sql
USE reimbursement_db;

DROP PROCEDURE IF EXISTS expect_error;
DROP PROCEDURE IF EXISTS expect_ok;
DROP TEMPORARY TABLE IF EXISTS test_result;

-- MEMORY engine: not transactional, so the results survive the final ROLLBACK
CREATE TEMPORARY TABLE test_result (
    n       INT AUTO_INCREMENT PRIMARY KEY,
    rule    VARCHAR(10),
    test    VARCHAR(120),
    result  VARCHAR(4),
    message VARCHAR(255)
) ENGINE = MEMORY;

DELIMITER $$

-- Runs p_sql; PASS if the database rejects it
CREATE PROCEDURE expect_error(IN p_rule VARCHAR(10), IN p_test VARCHAR(120), IN p_sql TEXT)
BEGIN
    DECLARE v_failed BOOLEAN DEFAULT FALSE;
    DECLARE v_msg    VARCHAR(255) DEFAULT 'accepted, but should have been rejected';
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
        SET v_failed = TRUE;
    END;
    SET @sql = p_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    INSERT INTO test_result (rule, test, result, message)
    VALUES (p_rule, p_test, IF(v_failed, 'PASS', 'FAIL'), v_msg);
END$$

-- Runs p_sql; PASS if the database accepts it
CREATE PROCEDURE expect_ok(IN p_rule VARCHAR(10), IN p_test VARCHAR(120), IN p_sql TEXT)
BEGIN
    DECLARE v_failed BOOLEAN DEFAULT FALSE;
    DECLARE v_msg    VARCHAR(255) DEFAULT 'accepted';
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
        SET v_failed = TRUE;
    END;
    SET @sql = p_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    INSERT INTO test_result (rule, test, result, message)
    VALUES (p_rule, p_test, IF(v_failed, 'FAIL', 'PASS'), v_msg);
END$$

DELIMITER ;

START TRANSACTION;

-- Keys
CALL expect_error('C1', 'Duplicate expense item number in one claim',
    "INSERT INTO expense_item VALUES (9, 1, 'FOOD', 'x', 10, '2026-10-10', NULL)");
CALL expect_error('C2', 'Two employees with the same email',
    "INSERT INTO employee (name, email, password_hash, designation, date_of_joining, dept_id) VALUES ('X', 'arjun@rms.test', REPEAT('x', 60), 'Intern', '2026-01-01', 1)");
CALL expect_error('C2', 'Two departments with the same name',
    "INSERT INTO department (dept_name, location) VALUES ('Sales', 'Delhi')");
CALL expect_error('C2', 'Two applicants with the same bank account',
    "INSERT INTO applicant VALUES (10, '50100234567801')");

-- Foreign keys and delete rules
CALL expect_error('C3', 'Claim by an employee who is not an applicant (Karan)',
    "INSERT INTO reimbursement (applicant_id, claim_type) VALUES (10, 'TRAVEL')");
CALL expect_error('C3', 'Claim decided by a non-manager (Arjun)',
    "UPDATE reimbursement SET status = 'REJECTED', approved_by = 5, approval_date = '2026-10-26', remarks = 'x' WHERE reimbursement_id = 10");
CALL expect_error('C3', 'Delete a department that has employees (RESTRICT)',
    "DELETE FROM department WHERE dept_id = 1");
CALL expect_error('C3', 'Delete an employee who has claims (RESTRICT via reimbursement)',
    "DELETE FROM employee WHERE employee_id = 5");
CALL expect_ok('setup', 'A new team lead with no role and no claims, made Karan''s supervisor',
    "INSERT INTO employee VALUES (200, 'Team Lead', 'lead@rms.test', REPEAT('x', 60), 'Team Lead', '2026-01-01', 1, 2)");
CALL expect_ok('setup', '... Karan now reports to the team lead',
    "UPDATE employee SET supervisor_id = 200 WHERE employee_id = 10");
CALL expect_error('C3', 'Delete a supervisor who still has subordinates (RESTRICT)',
    "DELETE FROM employee WHERE employee_id = 200");
CALL expect_ok('C3', 'Delete an empty department (Legal)',
    "DELETE FROM department WHERE dept_id = 5");

-- NOT NULL
CALL expect_error('C4', 'Employee without a department (WORKS_IN is total)',
    "INSERT INTO employee (name, email, password_hash, designation, date_of_joining, dept_id) VALUES ('X', 'x@rms.test', REPEAT('x', 60), 'Intern', '2026-01-01', NULL)");

-- CHECK constraints
CALL expect_error('C5', 'Status outside the four values',
    "UPDATE reimbursement SET status = 'CLOSED' WHERE reimbursement_id = 9");
CALL expect_error('C6', 'Claim of an unknown type',
    "INSERT INTO reimbursement (applicant_id, claim_type) VALUES (5, 'FOOD')");
CALL expect_error('C7', 'Expense item with an unknown category',
    "INSERT INTO expense_item VALUES (9, 3, 'PARTY', 'x', 10, '2026-10-10', NULL)");
CALL expect_error('C8', 'Approve without recording the approver',
    "UPDATE reimbursement SET status = 'APPROVED' WHERE reimbursement_id = 9");
CALL expect_error('C9', 'Reject without remarks',
    "UPDATE reimbursement SET status = 'REJECTED', approved_by = 2, approval_date = '2026-10-26' WHERE reimbursement_id = 9");
CALL expect_ok('setup', 'Rahul (a manager) files a claim of his own',
    "INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type, claim_date) VALUES (100, 2, 'BUSINESS', '2026-10-25')");
CALL expect_ok('setup', '... with one item',
    "INSERT INTO expense_item VALUES (100, 1, 'FOOD', 'Team lunch', 1200, '2026-10-24', NULL)");
CALL expect_error('C10', 'Rahul approves his own claim',
    "UPDATE reimbursement SET status = 'APPROVED', approved_by = 2, approval_date = '2026-10-26' WHERE reimbursement_id = 100");
CALL expect_error('C11', 'Decision dated before the claim',
    "UPDATE reimbursement SET status = 'APPROVED', approved_by = 1, approval_date = '2026-10-01' WHERE reimbursement_id = 100");
CALL expect_error('C12', 'Expense item with amount 0',
    "INSERT INTO expense_item VALUES (9, 3, 'FOOD', 'x', 0, '2026-10-10', NULL)");
CALL expect_error('C12', 'Negative approval limit',
    "UPDATE manager SET approval_limit = -5 WHERE employee_id = 2");
CALL expect_error('C13', 'Phone number with letters',
    "INSERT INTO employee_phone VALUES (10, 'call-me')");
CALL expect_error('C14', 'Email without a domain',
    "UPDATE employee SET email = 'karan' WHERE employee_id = 10");

ROLLBACK;

-- Failed and rolled-back inserts still use up AUTO_INCREMENT values; put them back.
ALTER TABLE department    AUTO_INCREMENT = 1;
ALTER TABLE employee      AUTO_INCREMENT = 1;
ALTER TABLE reimbursement AUTO_INCREMENT = 1;

SELECT n, rule, result, test, message FROM test_result ORDER BY n;
SELECT SUM(result = 'PASS') AS passed, SUM(result = 'FAIL') AS failed FROM test_result;

DROP PROCEDURE expect_error;
DROP PROCEDURE expect_ok;
DROP TEMPORARY TABLE test_result;
