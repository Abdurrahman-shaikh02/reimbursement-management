-- =====================================================================
-- [C13] Least-privilege account for the Node.js server.
-- The application can read and write rows and call claim_total, but it
-- cannot create, alter or drop tables, triggers or constraints. A bug or
-- an injected query in the app therefore cannot switch off the rules the
-- schema enforces.
-- Change the password before using this anywhere but a lab machine.
-- =====================================================================
DROP USER IF EXISTS 'rms_app'@'%';
CREATE USER 'rms_app'@'%' IDENTIFIED BY 'rms_app_pass';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON rms.* TO 'rms_app'@'%';
FLUSH PRIVILEGES;
