-- =====================================================================
-- Reimbursement Management System (RMS) — relational schema, MySQL 8.0
--
-- Tags such as [E4] or [C5] refer to the decision register in
-- report/RMS_Design_Decisions.pdf, where each choice is justified.
-- Run as root (or any user with CREATE privileges); see db/setup.sh.
-- =====================================================================

DROP DATABASE IF EXISTS rms;
-- [C12] utf8mb4 stores any Unicode name (Devanagari, accents); InnoDB is
-- the only MySQL engine that enforces foreign keys and supports transactions.
CREATE DATABASE rms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE rms;

-- ---------------------------------------------------------------------
-- DEPARTMENT  [E1] promoted from an attribute of EMPLOYEE to an entity
-- ---------------------------------------------------------------------
CREATE TABLE department (
    dept_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,   -- [R1] surrogate key
    dept_name   VARCHAR(60)  NOT NULL,
    location    VARCHAR(60)  NOT NULL,
    CONSTRAINT pk_department      PRIMARY KEY (dept_id),
    CONSTRAINT uq_department_name UNIQUE (dept_name)    -- candidate key
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- EMPLOYEE  (superclass of APPLICANT, MANAGER, ADMIN)
--   WORKS_IN   (N:1, total)   folded in as dept_id NOT NULL   [R3]
--   SUPERVISES (1:N, partial) folded in as supervisor_id NULL [E3][R3]
-- ---------------------------------------------------------------------
CREATE TABLE employee (
    employee_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL,
    password_hash   CHAR(60)     NOT NULL,              -- [E16] bcrypt hash, never the password
    designation     VARCHAR(60)  NOT NULL,
    date_of_joining DATE         NOT NULL,
    dept_id         INT UNSIGNED NOT NULL,
    supervisor_id   INT UNSIGNED NULL,                  -- NULL = top of the hierarchy
    CONSTRAINT pk_employee            PRIMARY KEY (employee_id),
    CONSTRAINT uq_employee_email      UNIQUE (email),   -- candidate key, used for login
    CONSTRAINT fk_employee_department FOREIGN KEY (dept_id)
        REFERENCES department (dept_id),                -- [C4] RESTRICT: cannot drop a staffed department
    CONSTRAINT fk_employee_supervisor FOREIGN KEY (supervisor_id)
        REFERENCES employee (employee_id),              -- [C4] RESTRICT: re-assign subordinates first
    CONSTRAINT chk_employee_email     CHECK (email LIKE '_%@_%._%')
    -- Self-supervision and longer cycles are blocked by triggers [C10]:
    -- MySQL forbids AUTO_INCREMENT columns inside CHECK constraints.
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- EMPLOYEE_PHONE  [E2][R6] multivalued attribute -> its own relation
-- ---------------------------------------------------------------------
CREATE TABLE employee_phone (
    employee_id INT UNSIGNED NOT NULL,
    phone       VARCHAR(15)  NOT NULL,                  -- [C3] text, not a number
    CONSTRAINT pk_employee_phone  PRIMARY KEY (employee_id, phone),
    CONSTRAINT fk_phone_employee  FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,  -- [C4] part of the employee
    CONSTRAINT chk_phone_format   CHECK (REGEXP_LIKE(phone, '^[+]?[0-9]{10,14}$'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- ISA on EMPLOYEE: overlapping, partial  [E4][R2]
-- One relation per subclass; PK is also an FK to the superclass.
-- An employee may appear in any number of these tables (overlapping),
-- or in none of them (partial).
-- ---------------------------------------------------------------------
CREATE TABLE applicant (
    employee_id     INT UNSIGNED NOT NULL,
    bank_account_no VARCHAR(18)  NOT NULL,              -- [C3] leading zeros matter
    ifsc_code       CHAR(11)     NOT NULL,              -- [E6] identifies the bank branch
    CONSTRAINT pk_applicant      PRIMARY KEY (employee_id),
    CONSTRAINT uq_applicant_bank UNIQUE (ifsc_code, bank_account_no),  -- [E6] candidate key
    CONSTRAINT fk_applicant_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_applicant_account CHECK (REGEXP_LIKE(bank_account_no, '^[0-9]{9,18}$')),
    CONSTRAINT chk_applicant_ifsc    CHECK (REGEXP_LIKE(ifsc_code, '^[A-Z]{4}0[A-Z0-9]{6}$', 'c'))
) ENGINE = InnoDB;

CREATE TABLE manager (
    employee_id    INT UNSIGNED  NOT NULL,
    approval_limit DECIMAL(12,2) NOT NULL,              -- [E17][C2] per manager, exact decimal
    CONSTRAINT pk_manager PRIMARY KEY (employee_id),
    CONSTRAINT fk_manager_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_manager_limit CHECK (approval_limit > 0)
) ENGINE = InnoDB;

-- [E5] ADMIN has no attributes of its own; the subclass exists because only
-- admins take part in the PAYS relationship (textbook §6.8.1).
CREATE TABLE admin (
    employee_id INT UNSIGNED NOT NULL,
    CONSTRAINT pk_admin PRIMARY KEY (employee_id),
    CONSTRAINT fk_admin_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- REIMBURSEMENT (superclass of the three claim types)
--   SUBMITS (APPLICANT 1:N, total on REIMBURSEMENT) -> applicant_id NOT NULL [R3]
--   CLAIM_PROCESS aggregation needs no relation of its own; its key is
--   reimbursement_id                                                    [R5]
--   REVIEWS (MANAGER 1:N CLAIM_PROCESS, partial) -> reviewed_by, review_date, remarks [E8][R3]
--   PAYS    (ADMIN   1:N CLAIM_PROCESS, partial) -> paid_by, payment_date, payment_ref [E9][R3]
--   total_amount is derived, so it is not stored                       [E12][R7]
-- ---------------------------------------------------------------------
CREATE TABLE reimbursement (
    reimbursement_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    claim_type       VARCHAR(8)   NOT NULL,             -- [E10] defining attribute of the ISA
    applicant_id     INT UNSIGNED NOT NULL,
    claim_date       DATE         NOT NULL DEFAULT (CURRENT_DATE),
    status           VARCHAR(9)   NOT NULL DEFAULT 'SUBMITTED',   -- [E11]
    reviewed_by      INT UNSIGNED NULL,
    review_date      DATE         NULL,
    remarks          VARCHAR(255) NULL,
    paid_by          INT UNSIGNED NULL,
    payment_date     DATE         NULL,
    payment_ref      VARCHAR(30)  NULL,                 -- bank UTR number

    CONSTRAINT pk_reimbursement PRIMARY KEY (reimbursement_id),
    CONSTRAINT uq_reimbursement_payment_ref UNIQUE (payment_ref),

    CONSTRAINT fk_reimbursement_applicant FOREIGN KEY (applicant_id)
        REFERENCES applicant (employee_id),             -- [C4] RESTRICT: financial records are kept
    CONSTRAINT fk_reimbursement_reviewer  FOREIGN KEY (reviewed_by)
        REFERENCES manager (employee_id),
    CONSTRAINT fk_reimbursement_payer     FOREIGN KEY (paid_by)
        REFERENCES admin (employee_id),

    -- [C1] domain constraints
    CONSTRAINT chk_reimbursement_type   CHECK (claim_type IN ('TRAVEL', 'MEDICAL', 'BUSINESS')),
    CONSTRAINT chk_reimbursement_status CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID')),

    -- [C5] the review and payment columns must match the status
    CONSTRAINT chk_reimbursement_lifecycle CHECK (
        (status = 'SUBMITTED'
            AND reviewed_by IS NULL AND review_date IS NULL AND remarks IS NULL
            AND paid_by IS NULL AND payment_date IS NULL AND payment_ref IS NULL)
     OR (status = 'APPROVED'
            AND reviewed_by IS NOT NULL AND review_date IS NOT NULL
            AND paid_by IS NULL AND payment_date IS NULL AND payment_ref IS NULL)
     OR (status = 'REJECTED'
            AND reviewed_by IS NOT NULL AND review_date IS NOT NULL AND remarks IS NOT NULL
            AND paid_by IS NULL AND payment_date IS NULL AND payment_ref IS NULL)
     OR (status = 'PAID'
            AND reviewed_by IS NOT NULL AND review_date IS NOT NULL
            AND paid_by IS NOT NULL AND payment_date IS NOT NULL AND payment_ref IS NOT NULL)
    ),
    -- [C6] separation of duties
    CONSTRAINT chk_reimbursement_no_self_review  CHECK (reviewed_by IS NULL OR reviewed_by <> applicant_id),
    CONSTRAINT chk_reimbursement_no_self_payment CHECK (paid_by IS NULL OR paid_by <> applicant_id),
    CONSTRAINT chk_reimbursement_payer_not_reviewer CHECK (paid_by IS NULL OR paid_by <> reviewed_by),
    -- events happen in order
    CONSTRAINT chk_reimbursement_review_after_claim CHECK (review_date IS NULL OR review_date >= claim_date),
    CONSTRAINT chk_reimbursement_payment_after_review CHECK (payment_date IS NULL OR payment_date >= review_date),

    INDEX idx_reimbursement_status (status),            -- [C11] review and payment queues
    INDEX idx_reimbursement_claim_date (claim_date)     -- [C11] monthly reports
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- ISA on REIMBURSEMENT: disjoint, total, attribute-defined on claim_type
-- [E10][R2][R8]
-- One relation per subclass, PK = FK to the superclass. Disjointness (a
-- claim has details only in the table matching its claim_type) is checked
-- by the trg_*_bi triggers; see [R8] for why this is not done with a
-- composite foreign key.
-- ---------------------------------------------------------------------
CREATE TABLE travel_reimbursement (
    reimbursement_id INT UNSIGNED NOT NULL,
    travel_from      VARCHAR(60)  NOT NULL,
    travel_to        VARCHAR(60)  NOT NULL,
    distance_km      DECIMAL(7,1) NOT NULL,             -- [E18] distance of this trip
    CONSTRAINT pk_travel PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_travel_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE,  -- [C4] part of the claim
    CONSTRAINT chk_travel_distance CHECK (distance_km > 0)
) ENGINE = InnoDB;

CREATE TABLE medical_reimbursement (
    reimbursement_id INT UNSIGNED NOT NULL,
    hospital_name    VARCHAR(100) NOT NULL,
    treatment_type   VARCHAR(15)  NOT NULL,
    CONSTRAINT pk_medical PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_medical_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE,  -- [C4] part of the claim
    CONSTRAINT chk_medical_treatment CHECK (treatment_type IN
        ('CONSULTATION', 'DIAGNOSTICS', 'PHARMACY', 'DENTAL', 'HOSPITALISATION', 'OTHER'))
) ENGINE = InnoDB;

CREATE TABLE business_reimbursement (
    reimbursement_id INT UNSIGNED NOT NULL,
    purpose          VARCHAR(200) NOT NULL,
    client_name      VARCHAR(100) NULL,                 -- internal trips have no client
    CONSTRAINT pk_business PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_business_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE   -- [C4] part of the claim
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- EXPENSE_ITEM  weak entity, discriminator item_no  [E13][E14][E15]
-- CONTAINS (identifying) needs no relation of its own (textbook §6.7.5) [R4]
-- ---------------------------------------------------------------------
CREATE TABLE expense_item (
    reimbursement_id INT UNSIGNED      NOT NULL,
    item_no          SMALLINT UNSIGNED NOT NULL,
    category         VARCHAR(20)       NOT NULL,
    description      VARCHAR(200)      NOT NULL,
    amount           DECIMAL(10,2)     NOT NULL,        -- [C2]
    expense_date     DATE              NOT NULL,
    receipt_path     VARCHAR(255)      NULL,            -- [E15] file stored on disk
    CONSTRAINT pk_expense_item PRIMARY KEY (reimbursement_id, item_no),
    CONSTRAINT fk_item_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE,  -- [C4] existence dependency
    CONSTRAINT chk_item_no       CHECK (item_no >= 1),
    CONSTRAINT chk_item_amount   CHECK (amount > 0),
    CONSTRAINT chk_item_category CHECK (category IN
        ('FARE', 'LODGING', 'MEALS', 'FUEL', 'LOCAL_CONVEYANCE',
         'MEDICAL', 'SUPPLIES', 'ENTERTAINMENT', 'OTHER'))
) ENGINE = InnoDB;
