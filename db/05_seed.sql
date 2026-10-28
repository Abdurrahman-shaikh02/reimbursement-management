-- =============================================================================
-- Reimbursement Management System — 05_seed.sql
-- Sample data for the demo. Every password is "password123" (bcrypt hash below).
--
-- Claims are inserted the way the application does it: claim + details + items
-- while SUBMITTED, then decided with an UPDATE. So the seed itself passes
-- through the schema constraints. Application validations are tested separately.
-- =============================================================================
USE reimbursement_db;

INSERT INTO department (dept_id, dept_name, location) VALUES
    (1, 'Engineering',     'Pune'),
    (2, 'Sales',           'Mumbai'),
    (3, 'Finance',         'Pune'),
    (4, 'Human Resources', 'Pune'),
    (5, 'Legal',           'Mumbai');   -- no employees yet: DEPARTMENT is partial in WORKS_IN [R1]

-- Inserted top-down so every supervisor exists before their subordinates.
SET @pw = '$2b$10$ouPFKoOpu4kEf5hJLbx2FONotvNJiasuo3vkaWnwsaNrwumQxwWyi';  -- "password123"
INSERT INTO employee (employee_id, name, email, password_hash, designation, date_of_joining, dept_id, supervisor_id) VALUES
    (1,  'Anita Desai',    'anita@rms.test',  @pw, 'Director',               '2015-04-01', 3, NULL),  -- top of the tree
    (2,  'Rahul Mehta',    'rahul@rms.test',  @pw, 'Engineering Manager',    '2017-07-15', 1, 1),
    (3,  'Priya Nair',     'priya@rms.test',  @pw, 'Sales Manager',          '2018-02-01', 2, 1),
    (4,  'Sneha Kulkarni', 'sneha@rms.test',  @pw, 'Accountant',             '2019-06-10', 3, 1),
    (5,  'Arjun Rao',      'arjun@rms.test',  @pw, 'Software Engineer',      '2021-08-02', 1, 2),
    (6,  'Vikram Singh',   'vikram@rms.test', @pw, 'Senior Engineer',        '2020-01-20', 1, 2),
    (7,  'Kavya Iyer',     'kavya@rms.test',  @pw, 'Sales Executive',        '2022-03-14', 2, 3),
    (8,  'Rohan Joshi',    'rohan@rms.test',  @pw, 'Sales Executive',        '2022-11-07', 2, 3),
    (9,  'Meera Pillai',   'meera@rms.test',  @pw, 'HR Executive',           '2021-05-03', 4, 1),
    (10, 'Karan Shah',     'karan@rms.test',  @pw, 'Intern',                 '2026-07-01', 1, 5);

-- { phone } is multivalued: some employees have two numbers, Karan has none [A2]
INSERT INTO employee_phone (employee_id, phone) VALUES
    (1, '+919800000001'), (1, '02026110001'),
    (2, '+919800000002'),
    (3, '+919800000003'), (3, '+919800000033'),
    (4, '+919800000004'),
    (5, '+919800000005'),
    (6, '+919800000006'),
    (7, '+919800000007'),
    (8, '+919800000008'),
    (9, '+919800000009');

-- Roles. Overlapping: Rahul and Priya are managers AND applicants.
-- Partial: Karan (an intern with no bank account registered) has no role;
-- Anita is a manager only [S1].
INSERT INTO manager (employee_id, approval_limit) VALUES
    (1, 500000.00),
    (2,  50000.00),
    (3,  75000.00);

INSERT INTO applicant (employee_id, bank_account_no) VALUES
    (2, '50100234567801'),
    (3, '50100234567802'),
    (4, '50100234567803'),
    (5, '50100234567804'),
    (6, '50100234567805'),
    (7, '50100234567806'),
    (8, '50100234567807'),
    (9, '50100234567808');

-- -----------------------------------------------------------------------------
-- Claims: header, then its details row, then its items (all while SUBMITTED)
-- -----------------------------------------------------------------------------
INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type, claim_date) VALUES
    (1,  5, 'TRAVEL',   '2026-08-05'),
    (2,  7, 'BUSINESS', '2026-08-12'),
    (3,  6, 'MEDICAL',  '2026-08-20'),
    (4,  8, 'TRAVEL',   '2026-09-02'),
    (5,  9, 'BUSINESS', '2026-09-10'),
    (6,  2, 'TRAVEL',   '2026-09-18'),   -- a manager filing a claim (overlapping ISA)
    (7,  4, 'MEDICAL',  '2026-09-25'),
    (8,  3, 'BUSINESS', '2026-10-05'),
    (9,  5, 'BUSINESS', '2026-10-12'),
    (10, 7, 'TRAVEL',   '2026-10-15'),
    (11, 6, 'TRAVEL',   '2026-10-20'),
    (12, 8, 'MEDICAL',  '2026-10-22');   -- 85,000: only Anita's limit is high enough

INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km) VALUES
    (1,  'Pune',   'Bengaluru', 840.0),
    (4,  'Mumbai', 'Nashik',    170.0),
    (6,  'Pune',   'New Delhi', 1450.0),
    (10, 'Mumbai', 'Pune',      150.0),
    (11, 'Pune',   'Hyderabad', 560.0);

INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type) VALUES
    (3,  'Ruby Hall Clinic',  'Consultation and pharmacy'),
    (7,  'Jehangir Hospital', 'Diagnostics'),
    (12, 'Sahyadri Hospital', 'Hospitalisation');

INSERT INTO business_reimbursement (reimbursement_id, purpose, client_name) VALUES
    (2, 'Client meeting and lunch',       'Tata Motors'),
    (5, 'Campus recruitment drive',       NULL),          -- internal work, no client
    (8, 'Client dinner, renewal meeting', 'Infosys'),
    (9, 'Team offsite supplies',          NULL);

INSERT INTO expense_item (reimbursement_id, item_no, category, description, amount, expense_date, receipt_path) VALUES
    (1,  1, 'FARE',            'Flight Pune to Bengaluru',     6200.00, '2026-08-01', NULL),
    (1,  2, 'LODGING',         'Hotel, 2 nights',              7500.00, '2026-08-03', NULL),
    (1,  3, 'FOOD',            'Meals during the trip',        1800.00, '2026-08-03', NULL),
    (2,  1, 'FOOD',            'Lunch with client',            3400.00, '2026-08-11', NULL),
    (2,  2, 'LOCAL_TRANSPORT', 'Cab to client office',          650.00, '2026-08-11', NULL),
    (3,  1, 'MEDICAL',         'Consultation fee',             1500.00, '2026-08-18', NULL),
    (3,  2, 'MEDICAL',         'Pharmacy bill',                2300.00, '2026-08-18', NULL),
    (4,  1, 'FUEL',            'Fuel, own car',                1450.00, '2026-08-30', NULL),
    (4,  2, 'FOOD',            'Meals',                         600.00, '2026-08-30', NULL),
    (5,  1, 'FARE',            'Train tickets',                2400.00, '2026-09-05', NULL),
    (5,  2, 'LODGING',         'Guest house',                  3200.00, '2026-09-06', NULL),
    (5,  3, 'FOOD',            'Meals',                         900.00, '2026-09-06', NULL),
    (6,  1, 'FARE',            'Flight Pune to Delhi, return', 9800.00, '2026-09-12', NULL),
    (6,  2, 'LODGING',         'Hotel, 3 nights',             12000.00, '2026-09-15', NULL),
    (6,  3, 'LOCAL_TRANSPORT', 'Cabs in Delhi',                1100.00, '2026-09-15', NULL),
    (7,  1, 'MEDICAL',         'Blood tests and X-ray',        4200.00, '2026-09-22', NULL),
    (8,  1, 'FOOD',            'Dinner with client team',      5600.00, '2026-10-03', NULL),
    (9,  1, 'SUPPLIES',        'Stationery and banners',       2750.00, '2026-10-10', NULL),
    (9,  2, 'OTHER',           'Venue cleaning charge',         400.00, '2026-10-10', NULL),
    (10, 1, 'FARE',            'Bus tickets',                   850.00, '2026-10-14', NULL),
    (10, 2, 'FOOD',            'Meals',                         420.00, '2026-10-14', NULL),
    (11, 1, 'FARE',            'Train Pune to Hyderabad',      4800.00, '2026-10-16', NULL),
    (11, 2, 'LODGING',         'Hotel, 3 nights',              9000.00, '2026-10-19', NULL),
    (11, 3, 'FOOD',            'Meals',                        2200.00, '2026-10-19', NULL),
    (12, 1, 'MEDICAL',         'Hospital stay and surgery',   85000.00, '2026-10-20', NULL);

-- -----------------------------------------------------------------------------
-- Decisions (APPROVES) and payments. Claims 9–12 stay SUBMITTED for the demo.
-- -----------------------------------------------------------------------------
UPDATE reimbursement SET status = 'APPROVED', approved_by = 2, approval_date = '2026-08-07'  WHERE reimbursement_id = 1;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 3, approval_date = '2026-08-14'  WHERE reimbursement_id = 2;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 2, approval_date = '2026-08-21',
                         remarks = 'Within medical policy.'                                 WHERE reimbursement_id = 3;
UPDATE reimbursement SET status = 'REJECTED', approved_by = 3, approval_date = '2026-09-04',
                         remarks = 'No client visit on record for this trip.'               WHERE reimbursement_id = 4;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 1, approval_date = '2026-09-12'  WHERE reimbursement_id = 5;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 1, approval_date = '2026-09-20'  WHERE reimbursement_id = 6;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 3, approval_date = '2026-09-26'  WHERE reimbursement_id = 7;
UPDATE reimbursement SET status = 'APPROVED', approved_by = 1, approval_date = '2026-10-06'  WHERE reimbursement_id = 8;

UPDATE reimbursement SET status = 'PAID' WHERE reimbursement_id IN (1, 2, 3, 6, 8);
