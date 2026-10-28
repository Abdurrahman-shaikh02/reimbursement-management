-- Creates the database and its 10 tables. Needs MySQL 8.0.16+ (enforces CHECK).

DROP DATABASE IF EXISTS reimbursement_db;
CREATE DATABASE reimbursement_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE reimbursement_db;

CREATE TABLE department (
    dept_id     INT          NOT NULL AUTO_INCREMENT,
    dept_name   VARCHAR(60)  NOT NULL,
    location    VARCHAR(60)  NOT NULL,
    CONSTRAINT pk_department      PRIMARY KEY (dept_id),
    CONSTRAINT uq_department_name UNIQUE (dept_name)
) ENGINE = InnoDB;

-- WORKS_IN is folded in as dept_id, SUPERVISES as supervisor_id
CREATE TABLE employee (
    employee_id      INT           NOT NULL AUTO_INCREMENT,
    name             VARCHAR(80)   NOT NULL,
    email            VARCHAR(100)  NOT NULL,
    password_hash    CHAR(60)      NOT NULL,                 -- bcrypt hash
    designation      VARCHAR(50)   NOT NULL,
    date_of_joining  DATE          NOT NULL,
    dept_id          INT           NOT NULL,
    supervisor_id    INT           NULL,                     -- NULL = top of the hierarchy
    CONSTRAINT pk_employee       PRIMARY KEY (employee_id),
    CONSTRAINT uq_employee_email UNIQUE (email),
    CONSTRAINT fk_employee_dept FOREIGN KEY (dept_id)
        REFERENCES department (dept_id),
    CONSTRAINT fk_employee_supervisor FOREIGN KEY (supervisor_id)
        REFERENCES employee (employee_id),
    CONSTRAINT chk_employee_email CHECK (email LIKE '%_@_%._%')
) ENGINE = InnoDB;

-- Multivalued attribute phone of EMPLOYEE
CREATE TABLE employee_phone (
    employee_id  INT          NOT NULL,
    phone        VARCHAR(15)  NOT NULL,                      -- text: keeps "+91" and leading zeros
    CONSTRAINT pk_employee_phone PRIMARY KEY (employee_id, phone),
    CONSTRAINT fk_phone_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_phone_format CHECK (
        CHAR_LENGTH(phone) BETWEEN 7 AND 15 AND REGEXP_LIKE(phone, '^[+]?[0-9]+$'))
) ENGINE = InnoDB;

-- Subclasses of EMPLOYEE (overlapping, partial)
CREATE TABLE applicant (
    employee_id      INT          NOT NULL,
    bank_account_no  VARCHAR(18)  NOT NULL,
    CONSTRAINT pk_applicant      PRIMARY KEY (employee_id),
    CONSTRAINT uq_applicant_bank UNIQUE (bank_account_no),
    CONSTRAINT fk_applicant_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE manager (
    employee_id     INT            NOT NULL,
    approval_limit  DECIMAL(12,2)  NOT NULL,
    CONSTRAINT pk_manager PRIMARY KEY (employee_id),
    CONSTRAINT fk_manager_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT chk_manager_limit CHECK (approval_limit > 0)
) ENGINE = InnoDB;

-- SUBMITS is folded in as applicant_id; APPROVES as approved_by, approval_date, remarks
CREATE TABLE reimbursement (
    reimbursement_id  INT           NOT NULL AUTO_INCREMENT,
    applicant_id      INT           NOT NULL,
    claim_type        VARCHAR(10)   NOT NULL,
    claim_date        DATE          NOT NULL DEFAULT (CURRENT_DATE),
    status            VARCHAR(10)   NOT NULL DEFAULT 'SUBMITTED',
    approved_by       INT           NULL,
    approval_date     DATE          NULL,
    remarks           VARCHAR(255)  NULL,
    CONSTRAINT pk_reimbursement PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_reimbursement_applicant FOREIGN KEY (applicant_id)
        REFERENCES applicant (employee_id),
    CONSTRAINT fk_reimbursement_approver FOREIGN KEY (approved_by)
        REFERENCES manager (employee_id),

    CONSTRAINT chk_reimbursement_status CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID')),
    CONSTRAINT chk_reimbursement_type CHECK (claim_type IN ('TRAVEL', 'MEDICAL', 'BUSINESS')),
    CONSTRAINT chk_reimbursement_decision CHECK (
        (status = 'SUBMITTED' AND approved_by IS NULL AND approval_date IS NULL)
        OR (status <> 'SUBMITTED' AND approved_by IS NOT NULL AND approval_date IS NOT NULL)),
    CONSTRAINT chk_reimbursement_reject_remarks CHECK (
        status <> 'REJECTED' OR (remarks IS NOT NULL AND TRIM(remarks) <> '')),
    CONSTRAINT chk_reimbursement_not_self CHECK (approved_by IS NULL OR approved_by <> applicant_id),
    CONSTRAINT chk_reimbursement_dates CHECK (approval_date IS NULL OR approval_date >= claim_date),

    INDEX idx_reimbursement_status (status)
) ENGINE = InnoDB;

-- Subclasses of REIMBURSEMENT (disjoint, total)
CREATE TABLE travel_reimbursement (
    reimbursement_id  INT           NOT NULL,
    travel_from       VARCHAR(100)  NOT NULL,
    travel_to         VARCHAR(100)  NOT NULL,
    distance_km       DECIMAL(7,1)  NOT NULL,
    CONSTRAINT pk_travel PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_travel_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE,
    CONSTRAINT chk_travel_distance CHECK (distance_km > 0)
) ENGINE = InnoDB;

CREATE TABLE medical_reimbursement (
    reimbursement_id  INT           NOT NULL,
    hospital_name     VARCHAR(100)  NOT NULL,
    treatment_type    VARCHAR(60)   NOT NULL,
    CONSTRAINT pk_medical PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_medical_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE business_reimbursement (
    reimbursement_id  INT           NOT NULL,
    purpose           VARCHAR(200)  NOT NULL,
    client_name       VARCHAR(100)  NULL,
    CONSTRAINT pk_business PRIMARY KEY (reimbursement_id),
    CONSTRAINT fk_business_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Weak entity set: identified by its claim and item_no
CREATE TABLE expense_item (
    reimbursement_id  INT            NOT NULL,
    item_no           SMALLINT       NOT NULL,
    category          VARCHAR(20)    NOT NULL,
    description       VARCHAR(200)   NOT NULL,
    amount            DECIMAL(10,2)  NOT NULL,
    expense_date      DATE           NOT NULL,
    receipt_path      VARCHAR(255)   NULL,
    CONSTRAINT pk_expense_item PRIMARY KEY (reimbursement_id, item_no),
    CONSTRAINT fk_item_reimbursement FOREIGN KEY (reimbursement_id)
        REFERENCES reimbursement (reimbursement_id) ON DELETE CASCADE,
    CONSTRAINT chk_item_category CHECK (category IN
        ('FOOD', 'LODGING', 'FARE', 'FUEL', 'LOCAL_TRANSPORT', 'MEDICAL', 'SUPPLIES', 'OTHER')),
    CONSTRAINT chk_item_amount CHECK (amount > 0)
) ENGINE = InnoDB;
