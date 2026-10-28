// Turns application validation and database constraint errors into readable JSON responses.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Messages for the CHECK constraints in db/01_schema.sql
const CHECK_MESSAGES = {
  chk_employee_email: 'The email address is not valid.',
  chk_phone_format: 'A phone number may contain only digits and an optional leading +, 7 to 15 characters.',
  chk_manager_limit: 'The approval limit must be greater than zero.',
  chk_reimbursement_status: 'Unknown claim status.',
  chk_reimbursement_type: 'Unknown claim type.',
  chk_reimbursement_decision: 'A decision must record the manager and the date.',
  chk_reimbursement_reject_remarks: 'Remarks are required when rejecting a claim.',
  chk_reimbursement_not_self: 'You cannot decide your own claim.',
  chk_reimbursement_dates: 'A claim cannot be decided before the date it was filed.',
  chk_travel_distance: 'Distance must be greater than zero.',
  chk_item_category: 'Unknown expense category.',
  chk_item_amount: 'Every amount must be greater than zero.',
};

// Messages for the UNIQUE keys
const UNIQUE_MESSAGES = {
  uq_employee_email: 'Another employee already uses this email address.',
  uq_department_name: 'A department with this name already exists.',
  uq_applicant_bank: 'This bank account is already registered to another employee.',
};

// 'hospital_name' -> 'Hospital name'
const label = (column) => column.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function fromMysql(err) {
  switch (err.errno) {
    case 3819: { // CHECK constraint violated
      const name = /'([^']+)'/.exec(err.sqlMessage)?.[1];
      return [400, CHECK_MESSAGES[name] ?? 'A value is not allowed.'];
    }
    case 1062: { // duplicate key
      const key = /for key '(?:[^.']+\.)?([^']+)'/.exec(err.sqlMessage)?.[1];
      return [409, UNIQUE_MESSAGES[key] ?? 'This record already exists.'];
    }
    case 1451: // parent row still referenced
    case 1217: // same, when the user lacks table-level privileges
      return [409, 'This record is still referenced by other records (for example claims or employees) and cannot be deleted or changed.'];
    case 1452: // child row points at nothing
    case 1216:
      return [400, 'A referenced record does not exist.'];
    case 1048: // NOT NULL
      return [400, `${label(/'([^']+)'/.exec(err.sqlMessage)?.[1] ?? 'a field')} is required.`];
    case 1406: // too long
      return [400, `${label(/column '([^']+)'/.exec(err.sqlMessage)?.[1] ?? 'a value')} is too long.`];
    case 1292: // bad date or number
      return [400, 'A date or number is not valid.'];
    default:
      return null;
  }
}

// Express error middleware (4 arguments)
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'A receipt file is larger than 5 MB.' });
  const mapped = err.sqlMessage && fromMysql(err);
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}
