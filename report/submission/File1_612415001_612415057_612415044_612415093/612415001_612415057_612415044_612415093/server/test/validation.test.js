import assert from 'node:assert/strict';
import test from 'node:test';
import { validateClaim, validateClaimAction, validateSupervisor, validMoney } from '../../shared/validation.mjs';

const today = '2026-10-28';
const item = { category: 'FOOD', description: 'Lunch', amount: '10.50', expense_date: today };
const claim = { claim_type: 'TRAVEL', details: { travel_from: 'Pune', travel_to: 'Mumbai', distance_km: 150 }, items: [item] };
const manager = { id: 2, is_manager: true, approval_limit: 50000 };
const submitted = { applicant_id: 5, status: 'SUBMITTED', item_count: 1, total_amount: 50000 };
const employees = [
  { employee_id: 1, supervisor_id: null },
  { employee_id: 2, supervisor_id: 1 },
  { employee_id: 3, supervisor_id: 2 },
];

test('valid claims match each of the three claim types', () => {
  assert.equal(validateClaim(claim, today), '');
  assert.equal(validateClaim({ ...claim, claim_type: 'MEDICAL', details: { hospital_name: 'Clinic', treatment_type: 'Checkup' } }, today), '');
  assert.equal(validateClaim({ ...claim, claim_type: 'BUSINESS', details: { purpose: 'Client meeting' } }, today), '');
  assert.match(validateClaim({ ...claim, claim_type: 'MEDICAL' }, today), /required claim details/);
});

test('claim validation rejects missing items, future/invalid dates and invalid amounts', () => {
  assert.match(validateClaim({ ...claim, items: [] }, today), /at least one/);
  assert.match(validateClaim({ ...claim, items: [{ ...item, expense_date: '2026-10-29' }] }, today), /after the claim date/);
  assert.match(validateClaim({ ...claim, items: [{ ...item, expense_date: '2026-02-30' }] }, today), /valid expense date/);
  for (const amount of [0, -1, 'abc', 1.001, Infinity, 100000000]) {
    assert.match(validateClaim({ ...claim, items: [{ ...item, amount }] }, today), /amount must be positive/);
  }
  assert.equal(validMoney('99999999.99'), true);
  assert.match(validateClaim({ ...claim, details: { ...claim.details, distance_km: 0 } }, today), /Distance/);
  assert.match(validateClaim(null, today), /Choose a claim type/);
  assert.match(validateClaim(claim, undefined), /date is unavailable/);
});

test('approval requires a manager, another applicant, items and sufficient limit', () => {
  assert.equal(validateClaimAction(submitted, manager, 'APPROVED'), '');
  assert.match(validateClaimAction({ ...submitted, total_amount: 50000.01 }, manager, 'APPROVED'), /approval limit/);
  assert.match(validateClaimAction({ ...submitted, item_count: 0 }, manager, 'APPROVED'), /no expense items/);
  assert.match(validateClaimAction(submitted, { ...manager, id: 5 }, 'APPROVED'), /own claim/);
  assert.match(validateClaimAction(submitted, { ...manager, is_manager: false }, 'APPROVED'), /Only managers/);
});

test('decisions and payments enforce the workflow and rejection remarks', () => {
  assert.match(validateClaimAction(submitted, manager, 'REJECTED', '  '), /Remarks are required/);
  assert.equal(validateClaimAction(submitted, manager, 'REJECTED', 'Missing receipt'), '');
  assert.match(validateClaimAction(submitted, manager, 'PAID'), /Only approved/);
  for (const status of ['APPROVED', 'REJECTED', 'PAID']) {
    assert.match(validateClaimAction({ ...submitted, status }, manager, 'APPROVED'), /no longer waiting/);
  }
  assert.equal(validateClaimAction({ ...submitted, status: 'APPROVED' }, manager, 'PAID'), '');
  assert.match(validateClaimAction({ ...submitted, status: 'REJECTED' }, manager, 'PAID'), /Only approved/);
});

test('supervision rejects self-reference, indirect cycles and missing supervisors', () => {
  assert.match(validateSupervisor(2, 2, employees), /themselves/);
  assert.match(validateSupervisor('1', '3', employees), /circular/);
  assert.match(validateSupervisor(2, 999, employees), /does not exist/);
  assert.equal(validateSupervisor(3, 1, employees), '');
  assert.equal(validateSupervisor(1, '', employees), '');
  assert.equal(validateSupervisor(null, 3, employees), '');
  assert.match(validateSupervisor(9, 1, [{ employee_id: 1, supervisor_id: 2 }, { employee_id: 2, supervisor_id: 1 }]), /circular/);
});
