// Allowed values for the coded columns. These mirror the CHECK constraints
// in db/01_schema.sql, which remain the authority: the lists exist here only
// to fill the drop-downs in the UI.
export const CLAIM_TYPES = ['TRAVEL', 'MEDICAL', 'BUSINESS'];
export const STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'];
export const CATEGORIES = [
  'FARE', 'LODGING', 'MEALS', 'FUEL', 'LOCAL_CONVEYANCE',
  'MEDICAL', 'SUPPLIES', 'ENTERTAINMENT', 'OTHER',
];
export const TREATMENT_TYPES = [
  'CONSULTATION', 'DIAGNOSTICS', 'PHARMACY', 'DENTAL', 'HOSPITALISATION', 'OTHER',
];
