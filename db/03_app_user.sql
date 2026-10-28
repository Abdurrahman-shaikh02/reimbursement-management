-- The account the backend connects with. It can read and change rows but not
-- the schema, so the application cannot drop a table or a constraint.
-- Change the password for anything other than a local demo.
CREATE USER IF NOT EXISTS 'rms_app'@'%' IDENTIFIED BY 'rms_app_pass';
GRANT SELECT, INSERT, UPDATE, DELETE ON reimbursement_db.* TO 'rms_app'@'%';
FLUSH PRIVILEGES;
