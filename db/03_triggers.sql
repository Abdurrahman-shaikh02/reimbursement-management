-- Removes the legacy triggers and helper procedures.
-- Workflow, expense dates, approval limits and supervision are validated by the application.
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
