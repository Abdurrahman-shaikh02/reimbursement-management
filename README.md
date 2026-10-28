# Reimbursement Management System — DBMS Laboratory project

Employees file travel, medical and business expense claims made up of individual
bills; managers approve or reject them within their approval limit; approved claims
are marked paid. The emphasis of the project is the **database design**.

| Folder | What is in it |
|---|---|
| `report/RMS_Database_Design.pdf` (and `.docx`) | The report: problem statement, objectives, functional requirements, ER diagram, relational schemas, functional dependencies, normalization to 3NF, integrity constraints, and the justification of every design decision |
| `db/` | Commented SQL: schema, view, legacy trigger removal, app user, sample data, constraint tests |
| `server/` | REST API: Node.js + Express + mysql2 (plain SQL, no ORM) |
| `client/` | Web frontend: React + Tailwind CSS (Vite) |
| `report/er/`, `report/src/` | Sources of the diagrams and of the report |
| `references/` | The assignment, the original ER diagram and the textbook |

The comments in `db/*.sql` use the same decision IDs as the report (for example
`[R3]`, `[C10]`, `[T1]`), so each line of SQL can be traced to its justification.

## Running it

Needs Node.js 20+ and MySQL 8.0.16+ (older MySQL versions ignore CHECK constraints).

```bash
# 1. Database — a MySQL in Docker on port 3307 (or use your own server, see db/setup.sh)
docker compose up -d
./db/setup.sh                      # creates reimbursement_db with sample data (drops it first!)

# optional: run the constraint tests (all rows should say PASS; nothing is changed)
mysql -h 127.0.0.1 -P 3307 -u root -prootpass reimbursement_db < db/06_constraint_tests.sql

# 2. API on http://localhost:4000
cd server
cp .env.example .env
npm install
npm start

# 3. Frontend on http://localhost:5173 (in a second terminal)
cd client
npm install
npm run dev
```

For a single server instead of two: `cd client && npm run build`, then `npm start`
in `server/` serves the built frontend at http://localhost:4000.

## Demo accounts

All passwords are `password123`.

| Email | Roles |
|---|---|
| anita@rms.test | manager, limit ₹5,00,000 (only one who can approve claim #12) |
| priya@rms.test | manager (₹75,000) and applicant |
| rahul@rms.test | manager (₹50,000) and applicant |
| arjun@rms.test, vikram@rms.test, kavya@rms.test, rohan@rms.test, sneha@rms.test, meera@rms.test | applicant |
| karan@rms.test | no role (partial specialization) |

## Who can do what

- **Applicant**: submit a claim (one type, one or more items, optional receipts) and track it.
- **Manager**: approve or reject submitted claims that are not their own and are within their
  limit; mark approved claims paid; manage departments and employees; see reports.
  (The design has no separate admin role, decision E4, so managers do the admin work.)

The frontend validates claim details, expense dates, approval eligibility and supervisor
relationships before submitting. The API repeats these checks using shared validation
functions, locking rows when saving decisions or changing the reporting hierarchy.
Saved claims, details, decisions and expense items have no general edit endpoints.
The database keeps its CHECK constraints and foreign keys, but has no triggers.
`db/03_triggers.sql` removes legacy triggers and helper procedures. Direct SQL writes
bypass application rules, so use the application for changes.

Run `npm test` in `server/` for shared validation tests. With the local database
running, `npm run test:integration` also checks the API and concurrent writes using
temporary records, which are removed afterward.
The existing report documents the original trigger-based design; this README
describes the current implementation.

API responses include performance headers (all durations are milliseconds):

| Header | Meaning |
|---|---|
| `X-DB-Time-Ms` | Sum of database round-trip durations, including failed statements and transaction commands |
| `X-DB-Pool-Wait-Ms` | Time acquiring database connections, including pool queueing and connection setup |
| `X-DB-Query-Count` | Number of attempted SQL calls, including BEGIN, COMMIT and ROLLBACK |
| `X-Response-Time-Ms` | Server processing time up to sending response headers |
| `Server-Timing` | The same durations as `db`, `db_pool` and `app` metrics |

To inspect them, open browser developer tools, select **Network**, select an
`/api/` request, then open **Headers > Response Headers**. Restart the API server
after changing its source (or use `npm run dev`).
Database time is measured by the API around MySQL driver calls; it includes network
round trips and result decoding, rather than only execution inside MySQL. Pool
acquisition is measured separately. Parallel database durations are added together,
so their sum can exceed elapsed request time. No SQL text or parameters are exposed.
