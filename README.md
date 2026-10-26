# Reimbursement Management System

DBMS Laboratory mini project. Employees submit expense claims (travel, medical, business), managers approve or reject them within their approval limit, and finance admins pay approved claims. The database enforces every business rule itself.

- **Database:** MySQL 8.0 (≥ 8.0.16, which enforces CHECK constraints): 11 tables, 13 foreign keys, 18 CHECK constraints, 17 triggers, 2 views
- **Back end:** Node.js 20 + Express 5 (`server/`)
- **Front end:** React 19 + Tailwind CSS 4, built with Vite (`client/`)

## Documents (in `report/`)

| File | What it is |
| --- | --- |
| `RMS_Project_Report.pdf` / `.docx` | The submission report (File 2): problem statement, objectives, requirements, ER diagram, relational schemas, functional dependencies, normalization to 3NF |
| `RMS_Design_Decisions.pdf` / `.docx` | Every design decision with alternatives and trade-offs, a constraint and trigger catalogue, and viva questions with answers |
| `er/er_diagram.png` | Final ER diagram (textbook notation, with key) |
| `er/schema_diagram.png` | Relational schema diagram |
| `screenshots/` | Screens of the running application |

Decision IDs such as `[E17]` or `[C5]` in the SQL comments refer to sections of the design-decisions document.

## Project layout

```
db/
  01_schema.sql            tables, keys, foreign keys, CHECK constraints
  02_views.sql             claim_total() function, reimbursement_summary and employee_roles views
  03_triggers.sql          17 triggers + 2 helper procedures
  04_app_user.sql          least-privilege account used by the server
  05_seed.sql              sample data (11 employees, 27 claims)
  06_constraint_tests.sql  50 tests that try to break the rules (all rolled back)
  07_report_queries.sql    report queries: grouping, window function, recursive CTE
  setup.sh                 runs 01–05 in order
server/                    Express API
client/                    React UI
report/                    documents, diagrams, screenshots, and the scripts that build them
docker-compose.yml         optional MySQL 8.0 container on port 3307
```

## Running it

### 1. Database

Either start the bundled MySQL container (port 3307, root password `rootpass`):

```bash
docker compose up -d
./db/setup.sh
```

or use a local MySQL 8 server (port 3306):

```bash
DB_PORT=3306 DB_ROOT_PASSWORD='your-root-password' ./db/setup.sh
```

`setup.sh` uses the `mysql` command-line client (the trigger file needs its `DELIMITER` command). **It drops and recreates the `rms` database.**

If root on your machine uses socket authentication (Ubuntu's default), run the files as `sudo mysql < db/01_schema.sql` and so on, in order.

### 2. API server

```bash
cd server
cp .env.example .env        # set DB_PORT=3306 for a local MySQL
npm install
npm start                   # http://localhost:4000
```

### 3. Web app

```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Alternatively, run `npm run build` in `client/`; the API server then serves the built app at http://localhost:4000.

### Sample accounts (password `password123` for all)

| Email | Roles |
| --- | --- |
| vikram.singh@rms.example | Applicant |
| neha.joshi@rms.example | Applicant, manager (limit ₹10,000) |
| rahul.mehta@rms.example | Applicant, manager (limit ₹50,000) |
| priya.kulkarni@rms.example | Applicant, manager (limit ₹75,000) |
| anita.desai@rms.example | Applicant, manager (limit ₹5,00,000) |
| sneha.patil@rms.example | Applicant, admin |
| meera.shah@rms.example | Admin |
| karan.gupta@rms.example | No role (intern) |

## Showing that the rules hold

```bash
mysql -h127.0.0.1 -P3307 -uroot -p --protocol=TCP < db/06_constraint_tests.sql
```

Prints one row per test (rule, pass/FAIL, the database's own error message) and a summary. Everything runs in one transaction that is rolled back.

## Rebuilding the documents

```bash
./report/er/render.sh                          # diagrams (needs python3 and Google Chrome)
cd report/build && npm install && npm run build  # .docx and .pdf (needs LibreOffice and poppler-utils)
```
