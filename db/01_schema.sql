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

