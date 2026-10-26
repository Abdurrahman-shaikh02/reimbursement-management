// Content used by both documents: the ER inventory, the relational schemas,
// the functional dependencies and the normalization walkthrough.
import { bullets, callout, code, numbered, p, table } from './lib.js';

export const TEAM = [
  ['612415001', 'Abdurrahman Shaikh'],
  ['612415057', 'Dhruv Agarwal'],
  ['612415044', 'Mrudula Dagale'],
  ['612415093', 'Makarand S Kulkarni'],
];

export const ER_PNG = new URL('../er/er_diagram_nokey.png', import.meta.url).pathname;

export function notationTable() {
  return table(
    ['Symbol in the diagram', 'Meaning (Silberschatz Chapter 6)'],
    [
      ['Rectangle with a shaded header', 'Entity set; attributes listed below the name; primary key underlined (§6.2)'],
      ['Double rectangle', 'Weak entity set; its discriminator has a dashed underline (§6.5.3)'],
      ['Diamond / double diamond', 'Relationship set / identifying relationship of a weak entity set'],
      ['Arrow on a line (→)', 'The "one" side: each entity at the other end relates to at most one entity here (§6.4)'],
      ['Plain line', 'The "many" side'],
      ['Double line', 'Total participation: every entity of that set takes part in the relationship'],
      ['l..h on a line', 'Minimum and maximum number of relationships each entity of that set takes part in (e.g. 1..1, 0..*)'],
      ['Role label on a line (supervisor, subordinate)', 'Role indicator, needed when an entity set relates to itself'],
      ['Rectangle linked by a dashed line to a diamond', 'Descriptive attributes of the relationship'],
      ['{ phone }', 'Multivalued attribute'],
      ['total_amount ( )', 'Derived attribute'],
      ['Hollow arrowhead', 'Specialization (ISA), pointing to the superclass. Separate arrows = overlapping; one shared arrow = disjoint; the keyword "total" (dashed line to the arrowhead) = total specialization (§6.8)'],
      ['Box around a relationship and its entity sets', 'Aggregation: the relationship treated as an entity set (§6.8.5)'],
    ],
    [32, 68],
    { size: 17 },
  );
}
export const SCHEMA_PNG = new URL('../er/schema_diagram.png', import.meta.url).pathname;
export const shot = (name) => new URL(`../screenshots/${name}.png`, import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Entity sets
// ---------------------------------------------------------------------------
export function entityTable() {
  return table(
    ['Entity set', 'Kind', 'Attributes (key underlined)', 'Notes'],
    [
      ['DEPARTMENT', 'Strong', '[[dept_id]], dept_name, location', 'dept_name is also unique (candidate key).'],
      ['EMPLOYEE', 'Strong; superclass', '[[employee_id]], name, email, password_hash, designation, date_of_joining, { phone }',
        'Phone is multivalued. email is a candidate key and the login name.'],
      ['APPLICANT', 'Subclass of EMPLOYEE', 'bank_account_no, ifsc_code (inherits employee_id)', 'An employee who may file claims; needs a payout account.'],
      ['MANAGER', 'Subclass of EMPLOYEE', 'approval_limit (inherits employee_id)', 'May review claims up to approval_limit.'],
      ['ADMIN', 'Subclass of EMPLOYEE', 'none of its own (inherits employee_id)', 'Exists because only admins take part in PAYS.'],
      ['REIMBURSEMENT', 'Strong; superclass', '[[reimbursement_id]], claim_type, claim_date, status, total_amount ( )',
        'total_amount is derived from the items. claim_type defines the subclass.'],
      ['TRAVEL_REIMBURSEMENT', 'Subclass of REIMBURSEMENT', 'travel_from, travel_to, distance_km', 'Details of a travel claim.'],
      ['MEDICAL_REIMBURSEMENT', 'Subclass of REIMBURSEMENT', 'hospital_name, treatment_type', 'Details of a medical claim.'],
      ['BUSINESS_REIMBURSEMENT', 'Subclass of REIMBURSEMENT', 'purpose, client_name', 'client_name is optional (internal business).'],
      ['EXPENSE_ITEM', 'Weak (owner: REIMBURSEMENT)', '{{item_no}} (discriminator), category, description, amount, expense_date, receipt_path',
        'Identified by its claim plus item_no: "item 2 of claim 17".'],
      ['CLAIM_PROCESS', 'Aggregation', 'APPLICANT – SUBMITS – REIMBURSEMENT treated as one unit', 'REVIEWS and PAYS relate to it.'],
    ],
    [22, 18, 34, 26],
  );
}

// ---------------------------------------------------------------------------
// Relationship sets and specializations
// ---------------------------------------------------------------------------
export const RELATIONSHIPS = [
  {
    name: 'WORKS_IN',
    connects: 'EMPLOYEE – DEPARTMENT',
    card: 'Many-to-one',
    part: 'EMPLOYEE total; DEPARTMENT partial',
    drawn: 'Arrow to DEPARTMENT; double line from EMPLOYEE; 1..1 on EMPLOYEE, 0..* on DEPARTMENT',
    becomes: '`employee.dept_id` NOT NULL, FK → department',
    why: 'Every employee belongs to exactly one department, because spend is reported by department. A new department may have nobody in it yet.',
  },
  {
    name: 'SUPERVISES',
    connects: 'EMPLOYEE (supervisor) – EMPLOYEE (subordinate)',
    card: 'One-to-many',
    part: 'Both partial',
    drawn: 'Arrow on the supervisor line; role labels; 0..* (supervisor), 0..1 (subordinate)',
    becomes: '`employee.supervisor_id` NULL, FK → employee',
    why: 'Each employee reports to at most one person. The head of the organisation reports to nobody, and most employees supervise nobody. Role indicators are needed because both ends are the same entity set.',
  },
  {
    name: 'SUBMITS',
    connects: 'APPLICANT – REIMBURSEMENT',
    card: 'One-to-many',
    part: 'REIMBURSEMENT total; APPLICANT partial',
    drawn: 'Arrow to APPLICANT; double line from REIMBURSEMENT; 0..* on APPLICANT, 1..1 on REIMBURSEMENT',
    becomes: '`reimbursement.applicant_id` NOT NULL, FK → applicant',
    why: 'A claim cannot exist without the person who filed it, and has exactly one claimant. A new applicant has filed nothing yet.',
  },
  {
    name: 'REVIEWS',
    connects: 'MANAGER – CLAIM_PROCESS (aggregation)',
    card: 'One-to-many (one decision per claim)',
    part: 'Both partial',
    drawn: 'Arrow to MANAGER; plain line from the aggregation; 0..* on MANAGER, 0..1 on CLAIM_PROCESS; descriptive attributes review_date, remarks',
    becomes: '`reimbursement.reviewed_by`, `review_date`, `remarks` (NULL until reviewed); reviewed_by FK → manager',
    why: 'A claim is decided once, by one manager (single-level approval). A submitted claim has no decision yet; a manager may have decided nothing.',
  },
  {
    name: 'PAYS',
    connects: 'ADMIN – CLAIM_PROCESS (aggregation)',
    card: 'One-to-many (one payment per claim)',
    part: 'Both partial',
    drawn: 'Arrow to ADMIN; plain line from the aggregation; 0..* on ADMIN, 0..1 on CLAIM_PROCESS; descriptive attributes payment_date, payment_ref',
    becomes: '`reimbursement.paid_by`, `payment_date`, `payment_ref` (NULL until paid); paid_by FK → admin',
    why: 'An approved claim is paid by one bank transfer, recorded by one admin. Claims that are not approved are never paid.',
  },
  {
    name: 'CONTAINS (identifying)',
    connects: 'REIMBURSEMENT – EXPENSE_ITEM (weak)',
    card: 'One-to-many',
    part: 'Both total',
    drawn: 'Double diamond; arrow and double line to REIMBURSEMENT; double line to EXPENSE_ITEM; 1..* on REIMBURSEMENT, 1..1 on EXPENSE_ITEM',
    becomes: 'No relation of its own; expense_item has PK (reimbursement_id, item_no) and FK → reimbursement ON DELETE CASCADE',
    why: 'An item only exists inside its claim (existence dependency). A claim with no items has nothing to reimburse, so REIMBURSEMENT participates totally too.',
  },
];

export const SPECIALIZATIONS = [
  {
    name: 'ISA on EMPLOYEE',
    subclasses: 'APPLICANT, MANAGER, ADMIN',
    kind: 'Overlapping, partial',
    drawn: 'Three separate hollow arrows; no "total" keyword',
    becomes: 'Tables applicant, manager, admin; each PK is also an FK → employee',
    why: 'Roles combine: managers also file claims, and Sneha (finance) is both an applicant and an admin. An intern without a payout account (Karan) has no role yet.',
  },
  {
    name: 'ISA on REIMBURSEMENT',
    subclasses: 'TRAVEL_, MEDICAL_, BUSINESS_REIMBURSEMENT',
    kind: 'Disjoint, total; attribute-defined on claim_type',
    drawn: 'One shared hollow arrow; "total" keyword joined by a dashed line',
    becomes: 'Tables travel_/medical_/business_reimbursement; each PK is also an FK → reimbursement',
    why: 'Every claim is exactly one kind, and each kind has its own mandatory details and policy.',
  },
];

export function relationshipTable({ withWhy = false } = {}) {
  const headers = ['Relationship', 'Connects', 'Mapping cardinality', 'Participation', 'How it is drawn', 'Becomes in the schema'];
  const widths = [13, 16, 12, 13, 24, 22];
  if (withWhy) {
    headers.push('Why');
    widths.splice(0, widths.length, 10, 12, 9, 13, 18, 18, 20);
  }
  return table(
    headers,
    RELATIONSHIPS.map((r) => [`**${r.name}**`, r.connects, r.card, r.part, r.drawn, r.becomes, ...(withWhy ? [r.why] : [])]),
    widths,
    { size: 16 },
  );
}

export function specializationTable({ withWhy = false } = {}) {
  const headers = ['Specialization', 'Subclasses', 'Constraints', 'How it is drawn', 'Becomes in the schema'];
  const widths = [15, 19, 17, 23, 26];
  if (withWhy) {
    headers.push('Why');
    widths.splice(0, widths.length, 13, 15, 14, 18, 20, 20);
  }
  return table(
    headers,
    SPECIALIZATIONS.map((s) => [`**${s.name}**`, s.subclasses, s.kind, s.drawn, s.becomes, ...(withWhy ? [s.why] : [])]),
    widths,
    { size: 16 },
  );
}

// ---------------------------------------------------------------------------
// Relational schemas (textbook notation: primary key underlined)
// ---------------------------------------------------------------------------
export const SCHEMAS = [
  ['department ([[dept_id]], dept_name, location)', 'UNIQUE (dept_name)'],
  ['employee ([[employee_id]], name, email, password_hash, designation, date_of_joining, dept_id, supervisor_id)',
    'UNIQUE (email); dept_id → department; supervisor_id → employee (NULL allowed)'],
  ['employee_phone ([[employee_id]], [[phone]])', 'employee_id → employee'],
  ['applicant ([[employee_id]], bank_account_no, ifsc_code)', 'employee_id → employee; UNIQUE (ifsc_code, bank_account_no)'],
  ['manager ([[employee_id]], approval_limit)', 'employee_id → employee'],
  ['admin ([[employee_id]])', 'employee_id → employee'],
  ['reimbursement ([[reimbursement_id]], claim_type, applicant_id, claim_date, status, reviewed_by, review_date, remarks, paid_by, payment_date, payment_ref)',
    'applicant_id → applicant; reviewed_by → manager (NULL allowed); paid_by → admin (NULL allowed); UNIQUE (payment_ref)'],
  ['travel_reimbursement ([[reimbursement_id]], travel_from, travel_to, distance_km)', 'reimbursement_id → reimbursement'],
  ['medical_reimbursement ([[reimbursement_id]], hospital_name, treatment_type)', 'reimbursement_id → reimbursement'],
  ['business_reimbursement ([[reimbursement_id]], purpose, client_name)', 'reimbursement_id → reimbursement'],
  ['expense_item ([[reimbursement_id]], [[item_no]], category, description, amount, expense_date, receipt_path)',
    'reimbursement_id → reimbursement'],
];

export function schemaList() {
  const out = [];
  SCHEMAS.forEach(([schema, keys], i) => {
    out.push(p(`${i + 1}.  ${schema}`, { after: 20, keepNext: true }));
    out.push(p(`~${keys}~`, { size: 18, color: '555555', after: 100 }));
  });
  return out;
}

export function mappingTable() {
  return table(
    ['ER construct', 'Rule (textbook)', 'Result'],
    [
      ['Strong entity sets DEPARTMENT, EMPLOYEE, REIMBURSEMENT', 'One relation with the same attributes; same primary key (§6.7.1)', 'department, employee, reimbursement'],
      ['Multivalued attribute { phone }', 'New relation: owner\'s key + the attribute; both form the key (§6.7.2)', 'employee_phone (employee_id, phone)'],
      ['Derived attribute total_amount ( )', 'Not stored; computed when needed (§6.7.2)', 'Function `claim_total()` and view `reimbursement_summary`'],
      ['Weak entity set EXPENSE_ITEM', 'Owner\'s key + discriminator = primary key; FK to owner (§6.7.3)', 'expense_item (reimbursement_id, item_no, …)'],
      ['Identifying relationship CONTAINS', 'Redundant; no relation (§6.7.5)', 'Represented by expense_item\'s foreign key'],
      ['Many-to-one with total participation: WORKS_IN, SUBMITS', 'Merge into the "many" side (§6.7.6)', '`employee.dept_id`, `reimbursement.applicant_id` (NOT NULL)'],
      ['Many-to-one with partial participation: SUPERVISES, REVIEWS, PAYS', 'Merge into the "many" side, using NULLs (§6.7.6)', '`supervisor_id`; `reviewed_by`, `review_date`, `remarks`; `paid_by`, `payment_date`, `payment_ref`'],
      ['Specializations of EMPLOYEE and REIMBURSEMENT', 'Method 1: superclass relation plus one relation per subclass holding the superclass key (§6.8.6.1)', 'applicant, manager, admin; travel_/medical_/business_reimbursement'],
      ['Aggregation CLAIM_PROCESS', 'No relation of its own; its key is the key of SUBMITS (§6.8.6.2)', 'Key reimbursement_id, so REVIEWS and PAYS merge into reimbursement'],
    ],
    [30, 36, 34],
    { size: 17 },
  );
}

// ---------------------------------------------------------------------------
// Functional dependencies
// ---------------------------------------------------------------------------
export const FDS = [
  ['department', ['dept_id → dept_name, location', 'dept_name → dept_id'], '{dept_id}, {dept_name}'],
  ['employee', ['employee_id → name, email, password_hash, designation, date_of_joining, dept_id, supervisor_id', 'email → employee_id'],
    '{employee_id}, {email}'],
  ['employee_phone', ['Only trivial FDs (both attributes form the key)'], '{employee_id, phone}'],
  ['applicant', ['employee_id → bank_account_no, ifsc_code', 'ifsc_code, bank_account_no → employee_id'],
    '{employee_id}, {ifsc_code, bank_account_no}'],
  ['manager', ['employee_id → approval_limit'], '{employee_id}'],
  ['admin', ['Only trivial FDs'], '{employee_id}'],
  ['reimbursement', ['reimbursement_id → claim_type, applicant_id, claim_date, status, reviewed_by, review_date, remarks, paid_by, payment_date, payment_ref',
    'payment_ref → reimbursement_id (for paid claims; UNIQUE, NULL until paid)'], '{reimbursement_id}'],
  ['travel_reimbursement', ['reimbursement_id → travel_from, travel_to, distance_km'], '{reimbursement_id}'],
  ['medical_reimbursement', ['reimbursement_id → hospital_name, treatment_type'], '{reimbursement_id}'],
  ['business_reimbursement', ['reimbursement_id → purpose, client_name'], '{reimbursement_id}'],
  ['expense_item', ['reimbursement_id, item_no → category, description, amount, expense_date, receipt_path'], '{reimbursement_id, item_no}'],
];

export function fdTable() {
  return table(
    ['Relation', 'Functional dependencies that must hold (F)', 'Candidate keys', 'Highest normal form'],
    FDS.map(([rel, fds, keys]) => [`**${rel}**`, fds, keys, 'BCNF (so also 3NF)']),
    [18, 50, 18, 14],
    { size: 17 },
  );
}

export function nonFdTable() {
  return table(
    ['Dependency that does NOT hold', 'Reason (real-world fact)', 'Consequence for the design'],
    [
      ['name → employee_id', 'Two employees can share a name.', 'name is not a key; login uses email.'],
      ['location → dept_id', 'Several departments are in Pune.', 'location is an ordinary attribute of department.'],
      ['applicant_id → reimbursement_id', 'An applicant files many claims.', 'SUBMITS is one-to-many.'],
      ['applicant_id, claim_date → reimbursement_id', 'Two claims may be filed on the same day.', 'No unique constraint on that pair.'],
      ['reviewed_by → review_date', 'A manager reviews claims on many days.', 'review_date belongs to the review, i.e. the claim.'],
      ['travel_from, travel_to → distance_km', 'Distance is what was actually travelled on this trip (detours, return legs).', 'travel_reimbursement stays in BCNF; see decision E18.'],
      ['designation → approval_limit', 'Limits are set per manager, not per job title.', 'manager stays in BCNF; see decision E17.'],
      ['hospital_name → treatment_type', 'A hospital offers many treatments.', 'Both are attributes of the medical claim.'],
    ],
    [30, 38, 32],
    { size: 17 },
  );
}

// ---------------------------------------------------------------------------
// Normal-form definitions and the walkthrough from one flat relation
// ---------------------------------------------------------------------------
export function normalFormDefinitions() {
  return table(
    ['Normal form', 'Condition (Silberschatz §7.3, §7.8, Exercise 7.19)'],
    [
      ['1NF', 'Every attribute domain is atomic: no lists or sets inside a cell.'],
      ['2NF', 'In 1NF, and no non-prime attribute depends on a proper subset of a candidate key (no partial dependency). The textbook covers 2NF only in Exercise 7.19, calling it "of historical significance"; we show it because the assignment asks for every step up to 3NF.'],
      ['3NF', 'For every FD α → β in F⁺: it is trivial, or α is a superkey, or every attribute in β − α belongs to some candidate key. Equivalently for our purposes: no non-prime attribute depends transitively on a key.'],
      ['BCNF', 'For every non-trivial FD α → β in F⁺, α is a superkey. BCNF implies 3NF.'],
    ],
    [14, 86],
    { size: 18 },
  );
}

export function walkthrough() {
  return [
    p('To show that the schema is normalized (and not merely normal by luck), we start from the single flat relation a paper claim form or a spreadsheet would produce, and normalize it step by step.'),
    ...code(`
claim_form (reimbursement_id, claim_type, claim_date, status,
            applicant_id, applicant_name, email, dept_id, dept_name, location,
            bank_account_no, ifsc_code, phones,
            reviewed_by, approval_limit, review_date, remarks,
            item_no, category, description, amount, expense_date)`),
    p('**Functional dependencies (F)**', { after: 40, keepNext: true }),
    ...code(`
F1  reimbursement_id         -> claim_type, claim_date, status, applicant_id,
                                reviewed_by, review_date, remarks
F2  applicant_id             -> applicant_name, email, dept_id, bank_account_no, ifsc_code
F3  email                    -> applicant_id
F4  ifsc_code, bank_account_no -> applicant_id
F5  dept_id                  -> dept_name, location
F6  dept_name                -> dept_id
F7  reviewed_by              -> approval_limit
F8  reimbursement_id, item_no -> category, description, amount, expense_date`),
    p('**Candidate key.** (reimbursement_id, item_no)⁺ = all attributes: F8 gives the item columns, F1 the claim columns, then F2, F5 and F7 the rest. Neither attribute appears on the right of any FD, so every key must contain both: it is the only candidate key. Prime attributes: reimbursement_id, item_no.'),

    p('**Step 1: 1NF.** `phones` holds a list (e.g. "+9198…, 020…"), which is not atomic. Move it to its own relation. (Repeating each row once per phone would instead create the multivalued dependency applicant_id ↠ phone and multiply every item row.)', { before: 80 }),
    ...code('employee_phone (applicant_id, phone)        key: (applicant_id, phone)'),

    p('**Step 2: 2NF.** F1 is a partial dependency: claim_type, claim_date, status, applicant_id, … depend on reimbursement_id alone, a proper part of the key (and the applicant, department and reviewer columns follow from them). Split the item-level and claim-level facts:'),
    ...code(`
expense_item (reimbursement_id, item_no, category, description, amount, expense_date)
claim        (reimbursement_id, claim_type, claim_date, status, applicant_id, applicant_name,
              email, dept_id, dept_name, location, bank_account_no, ifsc_code,
              reviewed_by, approval_limit, review_date, remarks)`),
    p('Lossless: expense_item ∩ claim = {reimbursement_id}, which is a key of claim (§7.2.3 test). expense_item is now in BCNF: its only non-trivial FD is F8, whose left side is its key.'),

    p('**Step 3: 3NF.** claim (key reimbursement_id) still has transitive dependencies: reimbursement_id → applicant_id → applicant_name, email, …; applicant_id → dept_id → dept_name, location; and reimbursement_id → reviewed_by → approval_limit. Each makes a non-prime attribute depend on a non-key attribute. Decompose on F2, F5 and F7:'),
    ...code(`
reimbursement     (reimbursement_id, claim_type, claim_date, status, applicant_id,
                   reviewed_by, review_date, remarks)
applicant_details (applicant_id, applicant_name, email, dept_id, bank_account_no, ifsc_code)
department        (dept_id, dept_name, location)
manager           (reviewed_by -> employee_id, approval_limit)`),
    p('Lossless: each split shares an attribute that is a key of one side (applicant_id of applicant_details, dept_id of department, reviewed_by of manager).'),
    p('**Dependency preservation.** Every FD lies inside one final relation: F1 in reimbursement; F2, F3, F4 in applicant_details; F5, F6 in department; F7 in manager; F8 in expense_item. So each can be checked without a join (§7.4.4).'),
    p('**Cross-check with the 3NF synthesis algorithm (§7.5.2).** F is already a canonical cover (no extraneous attributes, one FD per left side). One schema per FD gives the relations above (F3, F4 and F6 fall inside F2\'s and F5\'s schemas and are dropped), and the candidate key (reimbursement_id, item_no) is contained in expense_item, so no extra key schema is needed. The algorithm produces the same result.'),
    ...callout([
      'The final relations are exactly the schema we derived from the ER diagram, with one difference: normalization alone keeps applicant_details as one relation. Our design splits it into **employee** and **applicant** because of the partial specialization: employees who are not applicants (an intern, a finance clerk) would otherwise need NULL bank details. Both parts are in BCNF.',
      'The payment columns (paid_by, payment_date, payment_ref) and the claim-type details were left out above to keep it short. They behave the same way: payment columns depend on reimbursement_id only, and the type-specific details move to the subclass relations to avoid NULLs, not because of any normal form.',
    ], { title: 'Result' }),
  ];
}

export function perTableNormalization() {
  return [
    p('Applying the definitions to every final relation:'),
    ...bullets([
      '**1NF** holds everywhere: every column is a single atomic value. The one multivalued attribute (phone) has its own relation.',
      '**2NF** only matters for relations with a composite key: employee_phone and expense_item. employee_phone has no non-prime attributes. In expense_item no attribute depends on reimbursement_id alone (claim-level facts live in reimbursement) or on item_no alone (item numbers repeat across claims).',
      '**3NF and BCNF.** In every relation, the left side of every non-trivial FD in the table above is a candidate key (dept_name, email, (ifsc_code, bank_account_no) and payment_ref are keys too). Every relation is therefore in BCNF, which implies 3NF.',
    ]),
  ];
}

export const DEMO_COMMANDS = `
docker compose up -d                                  # MySQL 8.0 on port 3307 (or use a local MySQL)
./db/setup.sh                                         # schema, views, triggers, app user, sample data
mysql -h127.0.0.1 -P3307 -uroot -p --protocol=TCP < db/06_constraint_tests.sql   # 50 tests
cd server && cp .env.example .env && npm install && npm start                   # API on :4000
cd client && npm install && npm run dev                                         # UI on :5173`;

export { numbered };
