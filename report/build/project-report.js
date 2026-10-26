// File 2 of the submission: the project report.
import { AlignmentType } from 'docx';
import {
  LANDSCAPE_WIDTH, PORTRAIT_WIDTH, bullets, callout, caption, code, image, p, pageBreak, section, table, withWidth,
} from './lib.js';
import {
  DEMO_COMMANDS, ER_PNG, SCHEMA_PNG, TEAM, entityTable, fdTable, mappingTable, nonFdTable, normalFormDefinitions,
  notationTable, perTableNormalization, relationshipTable, schemaList, shot, specializationTable, walkthrough,
} from './shared.js';

const TITLE = 'Reimbursement Management System — Project Report';

function cover() {
  return [
    p('', { after: 1800 }),
    p('DBMS Laboratory · Mini project', { size: 24, color: '555555', align: AlignmentType.CENTER, after: 200 }),
    p('Reimbursement Management System', { size: 52, bold: true, color: '1F3A68', align: AlignmentType.CENTER, after: 200 }),
    p('Project report: problem, requirements, ER design, relational schema, functional dependencies and normalization',
      { size: 24, color: '444444', align: AlignmentType.CENTER, after: 1200 }),
    ...table(['MIS number', 'Name'], TEAM, [35, 65], { total: 6000 }),
    p('October 2026', { size: 22, color: '555555', align: AlignmentType.CENTER, before: 600 }),
    pageBreak(),
  ];
}

export default function build(doc, tocHeadings) {
  const h = (level, text) => doc.h(level, text);

  const intro = [
    ...cover(),
    p('Contents', { size: 32, bold: true, color: '1F3A68', after: 200 }),
    ...doc.toc(tocHeadings),
    pageBreak(),

    h(1, '1. Problem statement'),
    p('Organisations repay employees for money they spend on the organisation\'s behalf: travel to clients, medical treatment covered by policy, and business expenses such as client meetings. In many offices this still runs on paper forms, e-mailed spreadsheets and bills stapled together. That process has well-known failures:'),
    ...bullets([
      'Receipts and forms get lost, and nobody can say where a claim is stuck.',
      'Approval authority is informal: a junior manager can approve a large claim, or a manager can approve their own.',
      'The same claim can be paid twice, and payments cannot be traced to a bank transfer.',
      'Totals are retyped by hand, so the approved amount and the paid amount can disagree with the bills.',
      'Finance cannot answer simple questions (spend by department, by month, by expense type) without re-entering data.',
    ]),
    p('The problem is to design and implement a database application in which employees submit claims made of itemised expenses, managers approve or reject them within their authority, and the finance team pays approved claims to the employee\'s bank account. The database must be the single source of truth and must itself refuse data that breaks the organisation\'s rules, whichever program writes to it.'),

    h(1, '2. Objectives'),
    ...bullets([
      'Model the reimbursement process with an E-R diagram using the notation of the course textbook (Silberschatz, Korth & Sudarshan, 7th ed.).',
      'Reduce the E-R diagram to relation schemas with the textbook\'s rules, identify every functional dependency, and normalize every relation to at least 3NF (all relations reach BCNF).',
      'Enforce the business rules inside MySQL with keys, foreign keys, CHECK constraints and triggers, so that no client can bypass them.',
      'Build a role-based web application (React front end, Node.js back end) for applicants, managers and admins.',
      'Keep a complete trail of who submitted, reviewed and paid each claim, and when.',
      'Provide reports on spending by department, claim type, expense category and month.',
    ]),

    h(1, '3. Functional requirements'),
    h(2, '3.1 Users and roles'),
    p('Every user is an employee. An employee can hold any combination of three roles, which matches the overlapping specialization in the ER diagram:'),
    ...table(
      ['Role', 'Who', 'What they do'],
      [
        ['Applicant', 'Employees with a registered payout bank account', 'File claims and track them'],
        ['Manager', 'Employees with an approval limit', 'Approve or reject other employees\' claims up to their limit'],
        ['Admin', 'Finance / administration staff', 'Pay approved claims; maintain employees, roles and departments'],
      ],
      [16, 40, 44],
    ),
    h(2, '3.2 Requirements by role'),
    ...table(
      ['ID', 'Requirement'],
      [
        ['FR1', 'All users sign in with their e-mail address and password; the menu shows only the functions of their roles.'],
        ['FR2', 'An applicant submits a claim of exactly one type (travel, medical or business) with the details of that type and one or more expense items (category, description, date, amount, optional receipt file).'],
        ['FR3', 'An applicant sees all their claims with type, date, number of items, total, status and progress (submitted, reviewed by whom and when, paid when and with which bank reference).'],
        ['FR4', 'An applicant can withdraw a claim until a manager has reviewed it.'],
        ['FR5', 'A manager sees a queue of submitted claims that they are allowed to decide: not their own, and with a total within their approval limit. Claims from their direct reports are listed first.'],
        ['FR6', 'A manager approves or rejects a claim; a rejection must state the reason. Each claim is decided once.'],
        ['FR7', 'A manager sees the claims they have reviewed.'],
        ['FR8', 'An admin sees approved claims waiting for payment, with the payee\'s bank account and IFSC code, and records each payment with its bank transfer reference (UTR).'],
        ['FR9', 'An admin adds and edits employees: personal details, department, supervisor, any number of phone numbers, and roles (applicant with bank details, manager with approval limit, admin).'],
        ['FR10', 'An admin adds, renames and deletes departments.'],
        ['FR11', 'Managers and admins see reports: claims by status, approved spend by department, claim type, expense category and month, the top claimants, and the reporting hierarchy.'],
      ],
      [8, 92],
    ),
    h(2, '3.3 Data rules the database must enforce'),
    ...table(
      ['ID', 'Rule'],
      [
        ['DR1', 'Only applicants can file claims, only managers can review them, and only admins can pay them.'],
        ['DR2', 'Nobody reviews or pays their own claim, and the person who approved a claim cannot also pay it.'],
        ['DR3', 'A manager may only decide claims whose total is within their approval limit.'],
        ['DR4', 'A claim moves only SUBMITTED → APPROVED or REJECTED, then APPROVED → PAID. Rejected and paid claims are closed.'],
        ['DR5', 'A rejection carries remarks; an approval or rejection carries the reviewer and date; a payment carries the admin, date and a unique bank reference.'],
        ['DR6', 'A claim has exactly one type, the details of that type only, and at least one expense item. Amounts are positive.'],
        ['DR7', 'Once reviewed, a claim\'s items and details cannot change, so the approved total is the paid total.'],
        ['DR8', 'Dates are in order (expense ≤ claim ≤ review ≤ payment) and never in the future.'],
        ['DR9', 'E-mail addresses, bank accounts (IFSC + account number) and payment references are unique.'],
        ['DR10', 'The reporting hierarchy has no cycles; an employee cannot supervise themselves.'],
        ['DR11', 'Departments with employees, and employees with claim history, cannot be deleted.'],
      ],
      [8, 92],
    ),
    h(2, '3.4 Non-functional requirements'),
    ...bullets([
      '**Integrity:** every rule above is enforced by the database, not only by the user interface.',
      '**Atomicity:** a claim, its details and its items are saved together or not at all.',
      '**Security:** passwords stored only as bcrypt hashes; parameterised SQL; the application connects with a database account that cannot change the schema.',
      '**Portability:** standard SQL (CHECK constraints rather than MySQL ENUMs) wherever MySQL allows it.',
    ]),
  ];

  const erPage = [
    h(1, '4. ER diagram'),
    image(ER_PNG, LANDSCAPE_WIDTH, { maxHeightDxa: 8300 }),
    caption('Figure 1. E-R diagram of the Reimbursement Management System (textbook notation; the symbol key is in Section 4.1). A full-resolution copy with the key drawn in is report/er/er_diagram.png.'),
  ];

  const erText = withWidth(LANDSCAPE_WIDTH, () => [
    h(2, '4.1 Notation used'),
    p('The diagram uses the notation of the course textbook (Chapter 6), so every symbol has the meaning given there:'),
    ...notationTable(),
    h(2, '4.2 Entity sets'),
    ...entityTable(),
    h(2, '4.3 Relationship sets'),
    p('Each relationship is described by its mapping cardinality, the participation of each side, and how the diagram shows both. A label l..h sits on the line next to the entity set it describes: on SUBMITS, 1..1 next to REIMBURSEMENT means every claim is submitted by exactly one applicant, and 0..* next to APPLICANT means an applicant submits any number of claims.'),
    ...relationshipTable(),
    h(2, '4.4 Specializations and aggregation'),
    ...specializationTable(),
    p('**Aggregation.** CLAIM_PROCESS treats the relationship "applicant submits reimbursement" as one unit. A manager reviews, and an admin pays, a submission: who claimed what. Modelling REVIEWS and PAYS against the aggregation (rather than as ternary relationships with APPLICANT and REIMBURSEMENT) avoids recording the applicant a second time and allowing a review whose applicant differs from the person who submitted the claim (textbook §6.8.5).'),
    h(2, '4.5 Changes from our ER diagram assignment'),
    p('The diagram above refines the one submitted for the ER assignment. Every change is justified in the separate Design Decisions document (decision numbers in brackets).'),
    ...table(
      ['Earlier diagram', 'Final diagram', 'Reason'],
      [
        ['Department was an attribute of EMPLOYEE', 'DEPARTMENT entity set and WORKS_IN [E1]', 'A department has its own attribute (location) and is shared; as an attribute it would cause a transitive dependency.'],
        ['APPROVES, no attributes', 'REVIEWS with review_date, remarks [E8]', 'A manager may also reject; decisions need a date and a reason.'],
        ['No way to record payment', 'ADMIN subclass and PAYS with payment_date, payment_ref [E5, E9]', 'Disbursement is a separate step by a separate person.'],
        ['Bank_Account_No only', 'bank_account_no + ifsc_code, unique together [E6]', 'Account numbers are unique only within a bank.'],
        ['Specialization of REIMBURSEMENT not qualified', 'Disjoint and total, defined on claim_type [E10]', 'Every claim is exactly one type.'],
        ['Status values not defined', 'SUBMITTED, APPROVED, REJECTED, PAID with fixed transitions [E11]', 'Gives the workflow and its constraints.'],
        ['—', 'password_hash on EMPLOYEE; category on EXPENSE_ITEM [E16, E14]', 'Sign-in; spend reports by category.'],
        ['Receipt', 'receipt_path [E15]', 'Files are stored on disk; the database keeps the path.'],
        ['CONTAINS: REIMBURSEMENT partial', 'REIMBURSEMENT total (1..*) [E13]', 'A claim with no items is meaningless.'],
        ['Ovals and 1/N labels', 'Attributes inside the rectangles; arrows, double lines and l..h', 'Matches the course textbook\'s notation.'],
      ],
      [28, 34, 38],
      { size: 17 },
    ),
  ]);

  const schemaText = [
    h(1, '5. Relational schemas'),
    h(2, '5.1 Reduction rules applied'),
    p('The relations come from the E-R diagram by the reduction rules of textbook §6.7 and §6.8.6:'),
    ...mappingTable(),
    h(2, '5.2 Resulting relation schemas'),
    p('Primary keys are underlined. Foreign keys and other keys are listed under each schema. All 11 relations are implemented in db/01_schema.sql.'),
    ...schemaList(),
  ];

  const schemaPage = [
    image(SCHEMA_PNG, LANDSCAPE_WIDTH, { maxHeightDxa: 8600 }),
    caption('Figure 2. Schema diagram (textbook §2.4): arrows run from each foreign key to the primary key it references.'),
  ];

  const fdText = [
    h(1, '6. Functional dependencies'),
    p('The functional dependencies below are the constraints that must hold on each relation; they come from the business rules, not from the sample data. Attribute closures were used to find the candidate keys (textbook §7.4.2).'),
    ...fdTable(),
    p('Equally important are the dependencies that do **not** hold. Each was checked against the real-world meaning of the data, because assuming one by mistake would change the keys and the normal forms:'),
    ...nonFdTable(),

    h(1, '7. Normalization up to 3NF'),
    h(2, '7.1 Definitions'),
    ...normalFormDefinitions(),
    h(2, '7.2 Every relation of the final schema'),
    ...perTableNormalization(),
    h(2, '7.3 Walkthrough from an unnormalized claim form'),
    ...walkthrough(),
  ];

  const implText = [
    h(1, '8. Implementation'),
    h(2, '8.1 Architecture'),
    ...table(
      ['Layer', 'Technology', 'Responsibility'],
      [
        ['Front end', 'React 19, React Router, Tailwind CSS (Vite)', 'Forms and screens for the three roles; shows database errors as messages.'],
        ['Back end', 'Node.js, Express 5, mysql2', 'Authentication (bcrypt, JWT), role checks, transactions, file uploads; every query parameterised.'],
        ['Database', 'MySQL 8.0 (InnoDB)', '11 tables, 13 foreign keys, 4 unique keys, 18 CHECK constraints, 17 triggers, 2 views, 1 function, 2 procedures.'],
      ],
      [14, 30, 56],
    ),
    h(2, '8.2 Where each rule is enforced'),
    ...table(
      ['Mechanism', 'Rules (Section 3.3)', 'Examples'],
      [
        ['Primary and unique keys', 'DR9, one decision per claim, item numbers per claim', 'uq_employee_email, uq_applicant_bank, uq_reimbursement_payment_ref'],
        ['Foreign keys (RESTRICT / CASCADE)', 'DR1, DR11, weak entity existence', 'fk_reimbursement_reviewer → manager; fk_item_reimbursement ON DELETE CASCADE'],
        ['CHECK constraints', 'DR2, DR5, DR6 (amount > 0), DR8 (order of dates), domains', 'chk_reimbursement_lifecycle, chk_reimbursement_no_self_review'],
        ['Triggers', 'DR3, DR4, DR6 (one type, at least one item), DR7, DR8 (not in future), DR10', 'trg_reimbursement_bu, trg_expense_item_bd, trg_employee_bu'],
        ['Transactions (server)', 'Claim, details and items saved atomically', 'POST /api/claims'],
      ],
      [24, 38, 38],
      { size: 17 },
    ),
    p('Rules need a trigger when a CHECK cannot express them: they read other rows or tables, compare old and new values, or need today\'s date. MySQL, like most systems, does not support SQL assertions (textbook §4.4.8). db/06_constraint_tests.sql runs 50 tests that try to break each rule and confirms the database rejects every one.'),
    h(2, '8.3 Screens'),
    image(shot('04-new-claim'), PORTRAIT_WIDTH, { maxHeightDxa: 9000 }),
    caption('Figure 3. New claim: one claim type with its details, then any number of expense items.'),
    image(shot('06-review-queue'), PORTRAIT_WIDTH, { maxHeightDxa: 7000 }),
    caption('Figure 4. Review queue: only claims the manager is allowed to decide.'),
    image(shot('08-approval-limit-trigger'), PORTRAIT_WIDTH, { maxHeightDxa: 8500 }),
    caption('Figure 5. A manager with a ₹10,000 limit tries to approve a ₹30,000 claim; the trigger\'s message is shown.'),
    image(shot('10-claim-payment-panel'), PORTRAIT_WIDTH, { maxHeightDxa: 8500 }),
    caption('Figure 6. Recording a payment against an approved claim.'),
    image(shot('11-reports'), PORTRAIT_WIDTH, { maxHeightDxa: 12000 }),
    caption('Figure 7. Reports: grouping, a window function (RANK) and a recursive query over SUPERVISES.'),
    h(2, '8.4 Running the project'),
    ...code(DEMO_COMMANDS),
    p('Sample accounts all use the password password123 (for example vikram.singh@rms.example as an applicant, rahul.mehta@rms.example as a manager, sneha.patil@rms.example as an admin). The repository README lists all of them.'),

    h(1, '9. Conclusion'),
    p('The database was designed top-down from an E-R model in the textbook\'s notation, reduced to 11 relation schemas with the standard rules, and checked against its functional dependencies: every relation is in BCNF, and therefore in 3NF. A walkthrough from a flat claim form reaches the same schema through 1NF, 2NF and 3NF, with lossless and dependency-preserving decompositions. Business rules are enforced in the database by keys, CHECK constraints and triggers, and a web application for all three roles runs on top of it.'),
    ...callout('The reasoning behind every design decision, the alternatives we rejected and the trade-offs we accepted are in the companion document, RMS_Design_Decisions.pdf.', { title: 'Further detail' }),
  ];

  return [
    section(intro, { title: TITLE }),
    section([...erPage, pageBreak(), ...erText], { landscape: true, title: TITLE }),
    section(schemaText, { title: TITLE }),
    section(schemaPage, { landscape: true, title: TITLE }),
    section([...fdText, ...implText], { title: TITLE }),
  ];
}
