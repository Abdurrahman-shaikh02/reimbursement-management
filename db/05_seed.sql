-- =============================================================================
-- Reimbursement Management System — 05_seed.sql
-- Sample data for the demo. Every password is "password123" (bcrypt hash below).
--
-- Claims are inserted the way the application does it: claim + details + items
-- while SUBMITTED, then decided with an UPDATE. So the seed itself passes
-- through every trigger and CHECK, and proves the rules accept valid data.
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

