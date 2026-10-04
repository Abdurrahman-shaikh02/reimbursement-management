-- =============================================================================
-- Reimbursement Management System — 01_schema.sql
-- Creates the database and its 10 tables.
--
-- Every design choice here is explained in report/RMS_Database_Design.pdf.
-- Tags in square brackets point to it:
--   E/A/R/S/G/W/M/K = design decisions (Section 6, 7, 11.4)
--   C1–C14          = constraints declared in the tables (Section 11.1)
--   T1–T4           = triggers, see 03_triggers.sql
--
-- Needs MySQL 8.0.16 or later: older versions parse CHECK constraints but ignore them [K1].
-- =============================================================================

DROP DATABASE IF EXISTS reimbursement_db;
CREATE DATABASE reimbursement_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE reimbursement_db;

-- -----------------------------------------------------------------------------
-- department: entity set DEPARTMENT [E1]
-- FDs: dept_id → dept_name, location ; dept_name → dept_id      (BCNF)
-- -----------------------------------------------------------------------------
CREATE TABLE department (
    dept_id     INT          NOT NULL AUTO_INCREMENT,   -- surrogate key [A1]
    dept_name   VARCHAR(60)  NOT NULL,
    location    VARCHAR(60)  NOT NULL,
    CONSTRAINT pk_department      PRIMARY KEY (dept_id),
    CONSTRAINT uq_department_name UNIQUE (dept_name)    -- candidate key [C2]
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- employee: entity set EMPLOYEE (superclass of APPLICANT and MANAGER) [E2]
--   WORKS_IN   (many-to-one, EMPLOYEE total)  folded in as dept_id NOT NULL      [R1][M1]
--   SUPERVISES (recursive one-to-many, partial) folded in as supervisor_id NULL [R2][M1]
-- FDs: employee_id → all other columns ; email → employee_id            (BCNF)
-- -----------------------------------------------------------------------------
CREATE TABLE employee (
    employee_id      INT           NOT NULL AUTO_INCREMENT,  -- surrogate key [A1]
    name             VARCHAR(80)   NOT NULL,                 -- atomic, not split [A12]
    email            VARCHAR(100)  NOT NULL,                 -- login name
    password_hash    CHAR(60)      NOT NULL,                 -- bcrypt hash only, never the password [A4]
    designation      VARCHAR(50)   NOT NULL,
    date_of_joining  DATE          NOT NULL,
    dept_id          INT           NOT NULL,                 -- NOT NULL = total participation in WORKS_IN [C4]
    supervisor_id    INT           NULL,                     -- NULL = top of the hierarchy (partial)
    CONSTRAINT pk_employee       PRIMARY KEY (employee_id),
    CONSTRAINT uq_employee_email UNIQUE (email),             -- candidate key [C2]
    -- No ON DELETE action = RESTRICT: move people before deleting their department [K3]
    CONSTRAINT fk_employee_dept FOREIGN KEY (dept_id)
        REFERENCES department (dept_id),
    -- RESTRICT: reassign subordinates before deleting their supervisor [K3]
    CONSTRAINT fk_employee_supervisor FOREIGN KEY (supervisor_id)
        REFERENCES employee (employee_id),
    CONSTRAINT chk_employee_email CHECK (email LIKE '%_@_%._%')   -- [C14]
    -- "Not your own supervisor, no cycles" cannot be a CHECK: MySQL forbids
    -- AUTO_INCREMENT columns in CHECK, and cycles need a recursive query. See T4.
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- employee_phone: multivalued attribute { phone } of EMPLOYEE [A2][§6.7.2]
-- All-key relation: no non-trivial FDs, so BCNF (and 4NF).
-- -----------------------------------------------------------------------------
CREATE TABLE employee_phone (
    employee_id  INT          NOT NULL,
    phone        VARCHAR(15)  NOT NULL,                      -- text: keeps "+91" and leading zeros
    CONSTRAINT pk_employee_phone PRIMARY KEY (employee_id, phone),
    -- CASCADE: a phone number is part of its employee [K3]
    CONSTRAINT fk_phone_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_phone_format CHECK (                        -- [C13]
        CHAR_LENGTH(phone) BETWEEN 7 AND 15 AND REGEXP_LIKE(phone, '^[+]?[0-9]+$'))
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- applicant, manager: subclasses of EMPLOYEE, overlapping and partial [S1].
-- Reduced with the textbook's method 1 [S3]: the superclass key is both the
-- primary key and a foreign key. An employee may be in both tables, or neither.
-- -----------------------------------------------------------------------------
CREATE TABLE applicant (
    employee_id      INT          NOT NULL,
    bank_account_no  VARCHAR(18)  NOT NULL,                  -- digits stored as text [A11]
    CONSTRAINT pk_applicant      PRIMARY KEY (employee_id),
    CONSTRAINT uq_applicant_bank UNIQUE (bank_account_no),   -- second candidate key; no shared payout accounts [C2]
    -- CASCADE: the subclass row is the same entity as the employee row [K3][§6.8.4]
    CONSTRAINT fk_applicant_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE manager (
    employee_id     INT            NOT NULL,
    approval_limit  DECIMAL(12,2)  NOT NULL,                 -- per manager, not per designation [A10]; DECIMAL for money [K5]
    CONSTRAINT pk_manager PRIMARY KEY (employee_id),
    CONSTRAINT fk_manager_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_manager_limit CHECK (approval_limit > 0)  -- [C12]
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- reimbursement: entity set REIMBURSEMENT (the claim header) [E3]
--   SUBMITS  (APPLICANT 1 : N, REIMBURSEMENT total) folded in as applicant_id NOT NULL [R3][M1]
--   APPROVES (MANAGER 1 : N CLAIM_PROCESS, both partial) folded in as
--            approved_by, approval_date, remarks, all NULL while pending [R4][M2]
--   CLAIM_PROCESS (the aggregation) needs no table: it uses this one [G1][M3]
-- FD: reimbursement_id → all other columns                              (BCNF)
-- total_amount is derived and NOT stored; see the view in 02_views.sql [A3]
-- -----------------------------------------------------------------------------
CREATE TABLE reimbursement (
    reimbursement_id  INT           NOT NULL AUTO_INCREMENT,
    applicant_id      INT           NOT NULL,                   -- who submitted (SUBMITS)
    claim_type        VARCHAR(10)   NOT NULL,                   -- which subclass table holds the details [A6]
    claim_date        DATE          NOT NULL DEFAULT (CURRENT_DATE),
    status            VARCHAR(10)   NOT NULL DEFAULT 'SUBMITTED', -- [A5]
    approved_by       INT           NULL,                       -- APPROVES: deciding manager (approve or reject)
    approval_date     DATE          NULL,                       -- APPROVES: date of the decision [A9]
    remarks           VARCHAR(255)  NULL,                       -- APPROVES: reason; required on rejection [A9]
    CONSTRAINT pk_reimbursement PRIMARY KEY (reimbursement_id),
    -- References applicant, not employee: only registered applicants can own claims [R3].
    -- RESTRICT: claims are financial records and are kept [K3]. (MySQL would also refuse an
    -- ON DELETE action here, because applicant_id and approved_by are used in CHECK C10.)
    CONSTRAINT fk_reimbursement_applicant FOREIGN KEY (applicant_id)
        REFERENCES applicant (employee_id),
    -- References manager: a non-manager can never be the approver [S1]
    CONSTRAINT fk_reimbursement_approver FOREIGN KEY (approved_by)
        REFERENCES manager (employee_id),

    -- [C5] the four statuses of the workflow [K4: CHECK ... IN, not ENUM or a lookup table]
    CONSTRAINT chk_reimbursement_status CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID')),
    -- [C6] the three claim types (disjoint, total specialization) [S2]
    CONSTRAINT chk_reimbursement_type CHECK (claim_type IN ('TRAVEL', 'MEDICAL', 'BUSINESS')),
    -- [C8] a decision exists exactly when the claim has left SUBMITTED
    CONSTRAINT chk_reimbursement_decision CHECK (
        (status = 'SUBMITTED' AND approved_by IS NULL AND approval_date IS NULL)
        OR (status <> 'SUBMITTED' AND approved_by IS NOT NULL AND approval_date IS NOT NULL)),
    -- [C9] a rejection needs a reason
    CONSTRAINT chk_reimbursement_reject_remarks CHECK (
        status <> 'REJECTED' OR (remarks IS NOT NULL AND TRIM(remarks) <> '')),
    -- [C10] no one decides their own claim
    CONSTRAINT chk_reimbursement_not_self CHECK (approved_by IS NULL OR approved_by <> applicant_id),
    -- [C11] a claim cannot be decided before it is filed
    CONSTRAINT chk_reimbursement_dates CHECK (approval_date IS NULL OR approval_date >= claim_date),

    INDEX idx_reimbursement_status (status)   -- the manager's queue filters on status
) ENGINE = InnoDB;

