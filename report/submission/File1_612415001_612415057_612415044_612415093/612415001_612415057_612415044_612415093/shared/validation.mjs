// Shared by browser forms and API handlers so business rules stay consistent.
export const CLAIM_TYPES = ['TRAVEL', 'MEDICAL', 'BUSINESS'];
export const CATEGORIES = ['FOOD', 'LODGING', 'FARE', 'FUEL', 'LOCAL_TRANSPORT', 'MEDICAL', 'SUPPLIES', 'OTHER'];

const DETAIL_FIELDS = {
  TRAVEL: { travel_from: 100, travel_to: 100 },
  MEDICAL: { hospital_name: 100, treatment_type: 60 },
  BUSINESS: { purpose: 200 },
};

export function validMoney(value, maximum = 99999999.99) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= maximum
    && Math.abs(number - Math.round(number * 100) / 100) <= Number.EPSILON * number;
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number(value.slice(0, 4)) >= 1000
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateClaim(data, claimDate) {
  if (!data || !CLAIM_TYPES.includes(data.claim_type)) return 'Choose a claim type.';
  if (!validDate(claimDate)) return 'The claim date is unavailable. Refresh the page and try again.';
  const details = data.details ?? {};
  for (const [field, maximum] of Object.entries(DETAIL_FIELDS[data.claim_type])) {
    if (typeof details[field] !== 'string' || !details[field].trim()) return 'Complete the required claim details.';
    if (details[field].length > maximum) return 'A claim detail is too long.';
  }
  if (data.claim_type === 'TRAVEL') {
    const distance = Number(details.distance_km);
    if (!Number.isFinite(distance) || distance <= 0 || distance > 999999.9
        || Math.abs(distance * 10 - Math.round(distance * 10)) > 0.000001) {
      return 'Distance must be greater than zero, with at most one decimal place.';
    }
  }
  if (data.claim_type === 'BUSINESS' && details.client_name != null
      && (typeof details.client_name !== 'string' || details.client_name.length > 100)) {
    return 'Client name must be at most 100 characters.';
  }
  if (!Array.isArray(data.items) || !data.items.length) return 'Add at least one expense item.';
  if (data.items.length > 32767) return 'There are too many expense items.';
  for (const [index, item] of data.items.entries()) {
    const prefix = 'Item ' + (index + 1) + ': ';
    if (!item || !CATEGORIES.includes(item.category)) return prefix + 'choose a category.';
    if (typeof item.description !== 'string' || !item.description.trim()) return prefix + 'enter a description.';
    if (item.description.length > 200) return prefix + 'description must be at most 200 characters.';
    if (!validMoney(item.amount)) return prefix + 'amount must be positive, with at most two decimal places.';
    if (!validDate(item.expense_date)) return prefix + 'enter a valid expense date.';
    if (item.expense_date > claimDate) return prefix + 'an expense cannot be dated after the claim date.';
  }
  return '';
}

export function validateClaimAction(claim, user, status, remarks = '') {
  if (!user?.is_manager) return 'Only managers can do this.';
  if (Number(claim.applicant_id) === Number(user.id)) return 'You cannot decide or pay your own claim.';
  if (status === 'PAID') {
    return claim.status === 'APPROVED' ? '' : 'Only approved claims can be marked paid.';
  }
  if (!['APPROVED', 'REJECTED'].includes(status)) return 'Decision must be APPROVED or REJECTED.';
  if (claim.status !== 'SUBMITTED') return 'This claim is no longer waiting for a decision.';
  if (typeof remarks !== 'string' || remarks.length > 255) return 'Remarks must be at most 255 characters.';
  if (status === 'REJECTED' && !remarks.trim()) return 'Remarks are required when rejecting a claim.';
  if (status === 'APPROVED') {
    if (!Number.isInteger(Number(claim.item_count)) || Number(claim.item_count) < 1) return 'A claim with no expense items cannot be approved.';
    if (!validMoney(claim.total_amount, 9999999999.99)) return 'The claim total is not valid for approval.';
    if (!validMoney(user.approval_limit, 9999999999.99)
        || Math.round(Number(claim.total_amount) * 100) > Math.round(Number(user.approval_limit) * 100)) {
      return 'The claim total exceeds your approval limit.';
    }
  }
  return '';
}

export function validateSupervisor(employeeId, supervisorId, employees) {
  if (supervisorId == null || supervisorId === '') return '';
  const supervisors = new Map(employees.map((employee) => [String(employee.employee_id), employee.supervisor_id]));
  const visited = new Set();
  let current = String(supervisorId);
  while (current) {
    if (employeeId != null && current === String(employeeId)) {
      return current === String(supervisorId)
        ? 'An employee cannot supervise themselves.'
        : 'This supervisor would create a circular reporting relationship.';
    }
    if (visited.has(current)) return 'This supervisor is already in a circular reporting relationship.';
    if (!supervisors.has(current)) return 'The selected supervisor does not exist. Refresh the employee list.';
    visited.add(current);
    const next = supervisors.get(current);
    current = next == null ? '' : String(next);
  }
  return '';
}
