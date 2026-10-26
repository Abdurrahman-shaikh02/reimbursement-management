-- =====================================================================
-- Sample data. Every account's password is: password123
--
-- Claims are inserted as SUBMITTED and then reviewed and paid with
-- UPDATE statements, exactly as the application does, so loading this
-- file also runs every trigger and CHECK constraint.
-- =====================================================================
USE rms;

SET @pw = '$2b$10$ouPFKoOpu4kEf5hJLbx2FONotvNJiasuo3vkaWnwsaNrwumQxwWyi';

INSERT INTO department (dept_id, dept_name, location) VALUES
    (1, 'Engineering',     'Pune'),
    (2, 'Sales',           'Mumbai'),
    (3, 'Finance',         'Pune'),
    (4, 'Human Resources', 'Pune'),
    (5, 'Operations',      'Bengaluru');

-- Supervisors are inserted before their subordinates (FK order).
INSERT INTO employee (employee_id, name, email, password_hash, designation, date_of_joining, dept_id, supervisor_id) VALUES
    ( 1, 'Anita Desai',    'anita.desai@rms.example',    @pw, 'Director of Operations',      '2012-04-02', 5, NULL),
    ( 2, 'Rahul Mehta',    'rahul.mehta@rms.example',    @pw, 'Engineering Manager',         '2016-07-11', 1, 1),
    ( 3, 'Priya Kulkarni', 'priya.kulkarni@rms.example', @pw, 'Sales Manager',               '2015-01-19', 2, 1),
    ( 4, 'Sneha Patil',    'sneha.patil@rms.example',    @pw, 'Accounts Manager',            '2017-09-04', 3, 1),
    ( 6, 'Neha Joshi',     'neha.joshi@rms.example',     @pw, 'Team Lead',                   '2018-03-05', 1, 2),
    ( 5, 'Vikram Singh',   'vikram.singh@rms.example',   @pw, 'Software Engineer',           '2021-06-14', 1, 6),
    ( 7, 'Arjun Nair',     'arjun.nair@rms.example',     @pw, 'Sales Executive',             '2022-08-01', 2, 3),
    ( 8, 'Kavya Iyer',     'kavya.iyer@rms.example',     @pw, 'Senior Sales Executive',      '2019-11-25', 2, 3),
    ( 9, 'Rohan Deshmukh', 'rohan.deshmukh@rms.example', @pw, 'HR Executive',                '2020-02-17', 4, 1),
    (10, 'Meera Shah',     'meera.shah@rms.example',     @pw, 'Accounts Executive',          '2023-01-09', 3, 4),
    (11, 'Karan Gupta',    'karan.gupta@rms.example',    @pw, 'Software Engineering Intern', '2026-07-01', 1, 6);

INSERT INTO employee_phone (employee_id, phone) VALUES
    (1, '+919822011001'), (1, '02026051100'),
    (2, '+919822011002'),
    (3, '+919822011003'), (3, '02266051103'),
    (4, '+919822011004'),
    (5, '+919822011005'),
    (6, '+919822011006'), (6, '+919822011066'),
    (7, '+919822011007'),
    (8, '+919822011008'),
    (9, '+919822011009'),
    (10, '+919822011010');
    -- Karan (11) has no phone on record: Phone is optional (0..*).

-- Overlapping, partial specialization:
--   Anita, Rahul, Priya, Neha  are applicants AND managers
--   Sneha                      is an applicant AND an admin
--   Meera                      is an admin only
--   Karan (intern)             is in no subclass yet
INSERT INTO applicant (employee_id, bank_account_no, ifsc_code) VALUES
    (1, '50100234567801', 'HDFC0001234'),
    (2, '30211876543',    'SBIN0000456'),
    (3, '002101567890',   'ICIC0002210'),
    (4, '91702003456789', 'UTIB0000890'),
    (5, '50100998877665', 'HDFC0001234'),
    (6, '7412589630',     'KKBK0001765'),
    (7, '30566112233',    'SBIN0000456'),
    (8, '004501998877',   'ICIC0002210'),
    (9, '91702005554443', 'UTIB0000890');

INSERT INTO manager (employee_id, approval_limit) VALUES
    (1, 500000.00),
    (2,  50000.00),
    (3,  75000.00),
    (6,  10000.00);

INSERT INTO admin (employee_id) VALUES (4), (10);

-- ---------------------------------------------------------------------
-- Claims: 27 claims, May to October 2026
-- ---------------------------------------------------------------------
INSERT INTO reimbursement (reimbursement_id, applicant_id, claim_type, claim_date) VALUES
    ( 1, 5, 'TRAVEL',   '2026-05-08'),
    ( 2, 7, 'BUSINESS', '2026-05-12'),
    ( 3, 8, 'TRAVEL',   '2026-05-20'),
    ( 4, 9, 'MEDICAL',  '2026-05-25'),
    ( 5, 6, 'TRAVEL',   '2026-06-03'),
    ( 6, 5, 'MEDICAL',  '2026-06-10'),
    ( 7, 3, 'BUSINESS', '2026-06-15'),
    ( 8, 7, 'TRAVEL',   '2026-06-22'),
    ( 9, 2, 'TRAVEL',   '2026-07-02'),
    (10, 4, 'MEDICAL',  '2026-07-06'),
    (11, 8, 'BUSINESS', '2026-07-14'),
    (12, 5, 'BUSINESS', '2026-07-20'),
    (13, 9, 'TRAVEL',   '2026-08-04'),
    (14, 6, 'MEDICAL',  '2026-08-10'),
    (15, 7, 'BUSINESS', '2026-08-18'),
    (16, 1, 'TRAVEL',   '2026-08-25'),
    (17, 5, 'TRAVEL',   '2026-09-05'),
    (18, 8, 'MEDICAL',  '2026-09-12'),
    (19, 9, 'BUSINESS', '2026-09-20'),
    (20, 2, 'BUSINESS', '2026-10-01'),
    (21, 7, 'TRAVEL',   '2026-10-08'),
    (22, 5, 'MEDICAL',  '2026-10-15'),
    (23, 6, 'BUSINESS', '2026-10-18'),
    (24, 3, 'TRAVEL',   '2026-10-20'),
    (25, 8, 'TRAVEL',   '2026-10-22'),
    (26, 1, 'BUSINESS', '2026-10-23'),
    (27, 9, 'TRAVEL',   '2026-10-24');

INSERT INTO travel_reimbursement (reimbursement_id, travel_from, travel_to, distance_km) VALUES
    ( 1, 'Pune',   'Mumbai',    150.0),
    ( 3, 'Mumbai', 'Nashik',    167.0),
    ( 5, 'Pune',   'Bengaluru', 840.0),
    ( 8, 'Mumbai', 'Pune',      150.0),
    ( 9, 'Pune',   'Hyderabad', 560.0),
    (13, 'Pune',   'Nagpur',    710.0),
    (16, 'Pune',   'New Delhi', 1420.0),
    (17, 'Pune',   'Goa',       450.0),
    (21, 'Mumbai', 'Surat',     280.0),
    (24, 'Mumbai', 'Bengaluru', 980.0),
    (25, 'Mumbai', 'Pune',      150.0),
    (27, 'Pune',   'Lonavala',   66.0);

INSERT INTO medical_reimbursement (reimbursement_id, hospital_name, treatment_type) VALUES
    ( 4, 'City Care Hospital',               'CONSULTATION'),
    ( 6, 'Lifeline Diagnostics',             'DIAGNOSTICS'),
    (10, 'Wellness Pharmacy',                'PHARMACY'),
    (14, 'Smile Dental Clinic',              'DENTAL'),
    (18, 'Sunrise Multispeciality Hospital', 'HOSPITALISATION'),
    (22, 'City Care Hospital',               'CONSULTATION');

INSERT INTO business_reimbursement (reimbursement_id, purpose, client_name) VALUES
    ( 2, 'Client demo of the order-tracking module', 'Sahyadri Logistics'),
    ( 7, 'Quarterly sales review with distributor',  'Deccan Traders'),
    (11, 'Trade fair stall setup',                   NULL),
    (12, 'Team offsite planning',                    NULL),
    (15, 'Product launch event',                     'Konkan Agro Foods'),
    (19, 'Campus recruitment drive',                 NULL),
    (20, 'Vendor evaluation visit',                  'Nimbus Cloud Services'),
    (23, 'Architecture workshop at client site',     'Sahyadri Logistics'),
    (26, 'Investor meeting',                         'Western Ghats Capital');

INSERT INTO expense_item (reimbursement_id, item_no, category, description, amount, expense_date) VALUES
    ( 1, 1, 'FARE',             'Train tickets Pune to Mumbai (return)', 1240.00, '2026-05-05'),
    ( 1, 2, 'LOCAL_CONVEYANCE', 'Cab from Dadar to client office',        680.00, '2026-05-05'),
    ( 1, 3, 'MEALS',            'Lunch during client visit',              450.00, '2026-05-05'),
    ( 2, 1, 'MEALS',            'Lunch with client team',                3200.00, '2026-05-11'),
    ( 2, 2, 'LOCAL_CONVEYANCE', 'Auto and cab fares',                     540.00, '2026-05-11'),
    ( 3, 1, 'FUEL',             'Fuel for own car',                      1800.00, '2026-05-18'),
    ( 3, 2, 'LODGING',          'Hotel, 1 night',                        2500.00, '2026-05-18'),
    ( 3, 3, 'MEALS',            'Meals',                                  600.00, '2026-05-19'),
    ( 4, 1, 'MEDICAL',          'Doctor consultation fee',                800.00, '2026-05-23'),
    ( 4, 2, 'MEDICAL',          'Prescribed medicines',                  1150.00, '2026-05-23'),
    ( 5, 1, 'FARE',             'Flights Pune to Bengaluru (return)',    6400.00, '2026-05-28'),
    ( 5, 2, 'LODGING',          'Hotel, 2 nights',                       7800.00, '2026-05-30'),
    ( 5, 3, 'MEALS',            'Meals for 3 days',                      1450.00, '2026-05-30'),
    ( 5, 4, 'LOCAL_CONVEYANCE', 'Airport cabs',                           920.00, '2026-05-30'),
    ( 6, 1, 'MEDICAL',          'Blood tests',                           2200.00, '2026-06-08'),
    ( 7, 1, 'FARE',             'Train tickets',                         3900.00, '2026-06-11'),
    ( 7, 2, 'LODGING',          'Hotel, 2 nights',                       5400.00, '2026-06-12'),
    ( 7, 3, 'MEALS',            'Business dinner',                       2100.00, '2026-06-12'),
    ( 8, 1, 'FARE',             'Bus tickets (return)',                   650.00, '2026-06-20'),
    ( 8, 2, 'LOCAL_CONVEYANCE', 'Local auto fares',                       400.00, '2026-06-20'),
    ( 9, 1, 'FARE',             'Flight tickets',                        5200.00, '2026-06-29'),
    ( 9, 2, 'LODGING',          'Hotel, 2 nights',                       6200.00, '2026-06-30'),
    ( 9, 3, 'MEALS',            'Meals',                                 1800.00, '2026-06-30'),
    (10, 1, 'MEDICAL',          'Prescribed medicines',                  1340.00, '2026-07-04'),
    (11, 1, 'SUPPLIES',         'Banners and brochures',                 4800.00, '2026-07-10'),
    (11, 2, 'MEALS',            'Team meals at the fair',                 900.00, '2026-07-11'),
    (12, 1, 'MEALS',            'Team dinner',                           2800.00, '2026-07-18'),
    (13, 1, 'FARE',             'Train tickets (return)',                3100.00, '2026-07-30'),
    (13, 2, 'LODGING',          'Hotel, 2 nights',                       3500.00, '2026-08-01'),
    (13, 3, 'MEALS',            'Meals',                                 1200.00, '2026-08-01'),
    (14, 1, 'MEDICAL',          'Root canal treatment',                  4500.00, '2026-08-07'),
    (15, 1, 'ENTERTAINMENT',    'Launch event venue and catering',       8200.00, '2026-08-14'),
    (15, 2, 'MEALS',            'Client dinner',                         2600.00, '2026-08-15'),
    (16, 1, 'FARE',             'Flights (return)',                     14500.00, '2026-08-18'),
    (16, 2, 'LODGING',          'Hotel, 3 nights',                      18000.00, '2026-08-21'),
    (16, 3, 'MEALS',            'Meals',                                 3800.00, '2026-08-21'),
    (16, 4, 'LOCAL_CONVEYANCE', 'Cabs',                                  2200.00, '2026-08-21'),
    (17, 1, 'FUEL',             'Fuel for own car',                      3600.00, '2026-09-01'),
    (17, 2, 'LODGING',          'Hotel, 1 night',                        4200.00, '2026-09-02'),
    (17, 3, 'MEALS',            'Meals',                                 1600.00, '2026-09-02'),
    (18, 1, 'MEDICAL',          'Hospital stay, 3 days',                42000.00, '2026-09-08'),
    (18, 2, 'MEDICAL',          'Medicines',                             6800.00, '2026-09-10'),
    (19, 1, 'FARE',             'Train tickets',                         2400.00, '2026-09-16'),
    (19, 2, 'MEALS',            'Meals',                                 1800.00, '2026-09-17'),
    (19, 3, 'SUPPLIES',         'Printed assessment papers',             1500.00, '2026-09-15'),
    (20, 1, 'FARE',             'Flight tickets',                        4100.00, '2026-09-28'),
    (20, 2, 'MEALS',            'Meals',                                 1300.00, '2026-09-29'),
    (21, 1, 'FARE',             'Train tickets',                         1900.00, '2026-10-05'),
    (21, 2, 'LODGING',          'Hotel, 1 night',                        3200.00, '2026-10-06'),
    (21, 3, 'MEALS',            'Meals',                                 1100.00, '2026-10-06'),
    (22, 1, 'MEDICAL',          'Consultation fee',                       900.00, '2026-10-13'),
    (22, 2, 'MEDICAL',          'Medicines',                             1450.00, '2026-10-13'),
    (23, 1, 'FARE',             'Flight tickets',                        7600.00, '2026-10-12'),
    (23, 2, 'LODGING',          'Hotel, 3 nights',                       9800.00, '2026-10-15'),
    (23, 3, 'MEALS',            'Meals',                                 2900.00, '2026-10-15'),
    (24, 1, 'FARE',             'Flights (return)',                      8900.00, '2026-10-14'),
    (24, 2, 'LODGING',          'Hotel, 3 nights',                      15600.00, '2026-10-17'),
    (24, 3, 'MEALS',            'Meals',                                 3400.00, '2026-10-17'),
    (24, 4, 'LOCAL_CONVEYANCE', 'Cabs',                                  2100.00, '2026-10-17'),
    (25, 1, 'FARE',             'Train tickets',                          700.00, '2026-10-21'),
    (25, 2, 'MEALS',            'Meals',                                  380.00, '2026-10-21'),
    (26, 1, 'FARE',             'Flights (return)',                     26000.00, '2026-10-19'),
    (26, 2, 'LODGING',          'Hotel, 2 nights',                      22000.00, '2026-10-21'),
    (26, 3, 'MEALS',            'Meals',                                 9500.00, '2026-10-21'),
    (27, 1, 'FUEL',             'Fuel for own car',                       900.00, '2026-10-24');

-- ---------------------------------------------------------------------
-- Reviews (REVIEWS relationship). Each runs trg_reimbursement_bu, which
-- checks the reviewer's approval limit.
-- ---------------------------------------------------------------------
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 6, review_date = '2026-05-11' WHERE reimbursement_id = 1;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-05-14' WHERE reimbursement_id = 2;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-05-22' WHERE reimbursement_id = 3;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-05-27' WHERE reimbursement_id = 4;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 2, review_date = '2026-06-05' WHERE reimbursement_id = 5;
UPDATE reimbursement SET status = 'REJECTED', reviewed_by = 2, review_date = '2026-06-12',
       remarks = 'Routine diagnostics are covered by the group insurance policy; please claim there.'
 WHERE reimbursement_id = 6;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-06-17' WHERE reimbursement_id = 7;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-06-24' WHERE reimbursement_id = 8;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-07-04' WHERE reimbursement_id = 9;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-07-08' WHERE reimbursement_id = 10;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-07-16' WHERE reimbursement_id = 11;
UPDATE reimbursement SET status = 'REJECTED', reviewed_by = 6, review_date = '2026-07-21',
       remarks = 'Team events are funded from the department budget, not through reimbursements.'
 WHERE reimbursement_id = 12;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-08-06' WHERE reimbursement_id = 13;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 2, review_date = '2026-08-12' WHERE reimbursement_id = 14;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-08-20' WHERE reimbursement_id = 15;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-08-27',
       remarks = 'Approved; book economy class next time.'
 WHERE reimbursement_id = 16;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 6, review_date = '2026-09-07' WHERE reimbursement_id = 17;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 3, review_date = '2026-09-15' WHERE reimbursement_id = 18;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-09-22' WHERE reimbursement_id = 19;
UPDATE reimbursement SET status = 'APPROVED', reviewed_by = 1, review_date = '2026-10-03' WHERE reimbursement_id = 20;
-- Claims 21 to 27 are still SUBMITTED (waiting for review).

-- ---------------------------------------------------------------------
-- Payments (PAYS relationship). Claims 18 to 20 stay APPROVED (unpaid).
-- ---------------------------------------------------------------------
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-05-15', payment_ref = 'UTR260515000101' WHERE reimbursement_id = 1;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-05-20', payment_ref = 'UTR260520000102' WHERE reimbursement_id = 2;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-05-28', payment_ref = 'UTR260528000103' WHERE reimbursement_id = 3;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-06-02', payment_ref = 'UTR260602000104' WHERE reimbursement_id = 4;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-06-10', payment_ref = 'UTR260610000105' WHERE reimbursement_id = 5;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-06-22', payment_ref = 'UTR260622000107' WHERE reimbursement_id = 7;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-06-30', payment_ref = 'UTR260630000108' WHERE reimbursement_id = 8;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-07-09', payment_ref = 'UTR260709000109' WHERE reimbursement_id = 9;
-- Sneha (4) is an admin, but her own claim must be paid by someone else.
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-07-12', payment_ref = 'UTR260712000110' WHERE reimbursement_id = 10;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-07-22', payment_ref = 'UTR260722000111' WHERE reimbursement_id = 11;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-08-11', payment_ref = 'UTR260811000113' WHERE reimbursement_id = 13;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-08-18', payment_ref = 'UTR260818000114' WHERE reimbursement_id = 14;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-08-26', payment_ref = 'UTR260826000115' WHERE reimbursement_id = 15;
UPDATE reimbursement SET status = 'PAID', paid_by = 4,  payment_date = '2026-09-01', payment_ref = 'UTR260901000116' WHERE reimbursement_id = 16;
UPDATE reimbursement SET status = 'PAID', paid_by = 10, payment_date = '2026-09-12', payment_ref = 'UTR260912000117' WHERE reimbursement_id = 17;
