export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Readable messages for the named CHECK constraints in db/01_schema.sql.
const CHECK_MESSAGES = {
  chk_employee_email: 'Enter a valid email address.',
  chk_phone_format: 'Phone numbers must have 10 to 14 digits, optionally starting with +.',
  chk_applicant_account: 'Bank account numbers must have 9 to 18 digits.',
  chk_applicant_ifsc: 'IFSC codes look like HDFC0001234 (4 capital letters, 0, then 6 letters or digits).',
  chk_manager_limit: 'The approval limit must be greater than zero.',
  chk_reimbursement_type: 'Unknown claim type.',
  chk_reimbursement_status: 'Unknown claim status.',
  chk_reimbursement_lifecycle: 'The review and payment details do not match the claim status (a rejection needs remarks).',
  chk_reimbursement_no_self_review: 'You cannot review your own claim.',
  chk_reimbursement_no_self_payment: 'You cannot pay your own claim.',
  chk_reimbursement_payer_not_reviewer: 'The person who approved a claim cannot also pay it.',
  chk_reimbursement_review_after_claim: 'The review date cannot be before the claim date.',
  chk_reimbursement_payment_after_review: 'The payment date cannot be before the review date.',
  chk_travel_distance: 'Distance must be greater than zero.',
  chk_medical_treatment: 'Unknown treatment type.',
  chk_item_no: 'Item numbers start at 1.',
  chk_item_amount: 'Every expense amount must be greater than zero.',
  chk_item_category: 'Unknown expense category.',
};

// Readable messages for UNIQUE keys, by index name.
const DUPLICATE_MESSAGES = {
  uq_employee_email: 'Another employee already uses this email address.',
  uq_department_name: 'A department with this name already exists.',
  uq_applicant_bank: 'This bank account is already registered to another employee.',
  uq_reimbursement_payment_ref: 'This payment reference (UTR) has already been used.',
  PRIMARY: 'This record already exists.',
};

// Readable messages for a delete or update blocked by a foreign key, by constraint name.
const REFERENCED_MESSAGES = {
  fk_employee_department: 'This department still has employees. Move them first.',
  fk_employee_supervisor: 'This employee still supervises others. Reassign them first.',
  fk_reimbursement_applicant: 'This employee has claims on record, so they must stay an applicant (financial records are kept).',
  fk_reimbursement_reviewer: 'This employee has reviewed claims, so the manager role must stay (audit trail).',
  fk_reimbursement_payer: 'This employee has paid claims, so the admin role must stay (audit trail).',
};

function constraintName(message, pattern) {
  return message.match(pattern)?.[1];
}

// True when a delete or update was refused because other rows still refer to
// this one. Without table-level privileges on the child tables, MySQL reports
// 1217 (no constraint name) instead of 1451, so callers that know which
// relationship is involved supply their own message.
export function isStillReferenced(err) {
  return err.errno === 1451 || err.errno === 1217;
}

// Converts MySQL errors into HTTP errors. The database is the final
// authority on every rule, so its rejections reach the user as messages.
export function toHttpError(err) {
  if (err instanceof HttpError) return err;
  const msg = err.sqlMessage ?? '';
  switch (err.errno) {
    case 1644: // SIGNAL SQLSTATE '45000' raised by a trigger
      return new HttpError(422, msg);
    case 3819: { // CHECK constraint violated
      const name = constraintName(msg, /Check constraint '([^']+)'/);
      return new HttpError(422, CHECK_MESSAGES[name] ?? msg);
    }
    case 1062: { // duplicate key
      const key = constraintName(msg, /for key '(?:[^.']+\.)?([^']+)'/);
      return new HttpError(409, DUPLICATE_MESSAGES[key] ?? 'This value is already in use.');
    }
    case 1451: // parent row still referenced
    case 1217: {
      const name = constraintName(msg, /CONSTRAINT `([^`]+)`/);
      return new HttpError(409, REFERENCED_MESSAGES[name] ?? 'Other records still refer to this one.');
    }
    case 1452: // child row points to a missing parent
    case 1216:
      return new HttpError(422, 'A referenced record does not exist (or does not have the required role).');
    case 1048: // NOT NULL violated
      return new HttpError(422, msg.replace(/^Column '([^']+)' cannot be null$/, 'The field "$1" is required.'));
    case 1406: // value too long
      return new HttpError(422, msg.replace(/^Data too long for column '([^']+)'.*$/, 'The value for "$1" is too long.'));
    default:
      return new HttpError(500, 'Unexpected server error.');
  }
}
