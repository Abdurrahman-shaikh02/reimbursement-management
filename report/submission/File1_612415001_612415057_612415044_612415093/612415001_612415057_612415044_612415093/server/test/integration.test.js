// Runs against the configured local database; temporary claims/employees are removed afterward.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { pool } from '../src/db.js';

const port = process.env.INTEGRATION_PORT || '4107';
const base = 'http://127.0.0.1:' + port + '/api';

async function request(path, token, body, method = 'POST') {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  for (const header of ['X-DB-Time-Ms', 'X-DB-Pool-Wait-Ms', 'X-Response-Time-Ms']) {
    assert.match(response.headers.get(header), /^\d+\.\d{3}$/);
  }
  assert.match(response.headers.get('X-DB-Query-Count'), /^\d+$/);
  assert.match(response.headers.get('Server-Timing'), /db;dur=.*db_pool;dur=.*app;dur=/);
  return { status: response.status, data, headers: response.headers };
}

async function login(email) {
  const response = await request('/auth/login', null, { email, password: 'password123' });
  assert.equal(response.status, 200);
  return response.data.token;
}

function claimForm(claimDate, overrides = {}) {
  const form = new FormData();
  form.append('data', JSON.stringify({
    claim_type: 'BUSINESS', details: { purpose: 'Integration validation test' },
    items: [{ category: 'FOOD', description: 'Test expense', amount: 85000, expense_date: claimDate }],
    ...overrides,
  }));
  return form;
}

test('API enforces application rules with no database triggers', async (t) => {
  const child = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: port }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const claimIds = [];
  const employeeIds = [];
  t.after(async () => {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
    for (const id of claimIds) await pool.query('DELETE FROM reimbursement WHERE reimbursement_id = ?', [id]);
    for (const id of employeeIds) await pool.query('UPDATE employee SET supervisor_id = NULL WHERE employee_id = ?', [id]);
    for (const id of employeeIds) await pool.query('DELETE FROM employee WHERE employee_id = ?', [id]);
    await pool.end();
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API did not start')), 10000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('API exited before starting')); });
    child.stdout.on('data', (data) => {
      if (data.toString().includes('API listening')) { clearTimeout(timer); resolve(); }
    });
  });
  const arjun = await login('arjun@rms.test');
  const rahul = await login('rahul@rms.test');
  const priya = await login('priya@rms.test');
  const anita = await login('anita@rms.test');
  const meta = await request('/meta', arjun, undefined, 'GET');
  assert.equal(meta.status, 200);
  const date = meta.data.claimDate;
  await t.test('real database reads report timings and concurrent requests keep separate counts', async () => {
    assert.equal(meta.headers.get('X-DB-Query-Count'), '2');
    assert.ok(Number(meta.headers.get('X-DB-Time-Ms')) > 0);
    const responses = await Promise.all([
      request('/claims/1', anita, undefined, 'GET'),
      request('/meta', arjun, undefined, 'GET'),
      request('/meta', null, undefined, 'GET'),
    ]);
    assert.deepEqual(responses.map((response) => response.headers.get('X-DB-Query-Count')), ['4', '2', '0']);
    assert.equal(responses[2].status, 401);
    assert.equal(responses[2].headers.get('X-DB-Time-Ms'), '0.000');
    console.log('Example response: Server-Timing: ' + meta.headers.get('Server-Timing'));
  });
  const [[{ trigger_count: triggerCount }]] = await pool.query(
    'SELECT COUNT(*) AS trigger_count FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()',
  );
  assert.equal(triggerCount, 0);

  await t.test('direct submissions reject future dates, empty items and mismatched details', async () => {
    const future = new Date(date + 'T00:00:00Z');
    future.setUTCDate(future.getUTCDate() + 1);
    const futureDate = future.toISOString().slice(0, 10);
    const invalidClaims = [
      { items: [{ category: 'FOOD', description: 'Future', amount: 10, expense_date: futureDate }] },
      { items: [] },
      { claim_type: 'MEDICAL', details: { purpose: 'Wrong detail type' } },
    ];
    for (const overrides of invalidClaims) {
      const response = await request('/claims', arjun, claimForm(date, overrides));
      assert.equal(response.status, 400);
    }
  });

  const created = await request('/claims', arjun, claimForm(date));
  assert.equal(created.status, 201);
  const id = created.data.reimbursement_id;
  claimIds.push(id);
  await t.test('approval limits, rejection remarks and status transitions are checked at save time', async () => {
    const overLimit = await request('/claims/' + id + '/decision', rahul, { decision: 'APPROVED' });
    assert.equal(overLimit.status, 400);
    assert.match(overLimit.data.error, /approval limit/);
    const noRemarks = await request('/claims/' + id + '/decision', anita, { decision: 'REJECTED', remarks: '  ' });
    assert.equal(noRemarks.status, 400);
    const earlyPay = await request('/claims/' + id + '/pay', anita);
    assert.equal(earlyPay.status, 400);
    assert.equal((await request('/claims/' + id + '/decision', anita, { decision: 'APPROVED' })).status, 200);
    assert.equal((await request('/claims/' + id + '/decision', anita, { decision: 'REJECTED', remarks: 'Changed' })).status, 400);
    assert.equal((await request('/claims/' + id + '/pay', anita)).status, 200);
    assert.equal((await request('/claims/' + id + '/pay', anita)).status, 400);
  });

  await t.test('a manager cannot decide or pay their own claim', async () => {
    const createdOwn = await request('/claims', rahul, claimForm(date, {
      items: [{ category: 'FOOD', description: 'Own expense', amount: 10, expense_date: date }],
    }));
    assert.equal(createdOwn.status, 201);
    const ownId = createdOwn.data.reimbursement_id;
    claimIds.push(ownId);
    assert.equal((await request('/claims/' + ownId + '/decision', rahul, { decision: 'APPROVED' })).status, 400);
    assert.equal((await request('/claims/' + ownId + '/decision', anita, { decision: 'APPROVED' })).status, 200);
    assert.equal((await request('/claims/' + ownId + '/pay', rahul)).status, 400);
    assert.equal((await request('/claims/' + ownId + '/pay', anita)).status, 200);
  });

  await t.test('concurrent decisions allow only one saved decision', async () => {
    const createdRace = await request('/claims', arjun, claimForm(date, {
      items: [{ category: 'FOOD', description: 'Concurrent decisions', amount: 10, expense_date: date }],
    }));
    assert.equal(createdRace.status, 201);
    const raceId = createdRace.data.reimbursement_id;
    claimIds.push(raceId);
    const results = await Promise.all([
      request('/claims/' + raceId + '/decision', rahul, { decision: 'APPROVED' }),
      request('/claims/' + raceId + '/decision', priya, { decision: 'REJECTED', remarks: 'Test decision' }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  });

  await t.test('self-supervision and concurrent circular reporting changes are rejected', async () => {
    const employee = {
      name: 'Integration employee', designation: 'Tester', date_of_joining: date,
      dept_id: 1, supervisor_id: '', password: 'temporary-test-password', phones: [],
    };
    for (let index = 0; index < 2; index += 1) {
      const result = await request('/admin/employees', anita, { ...employee, email: 'integration-' + index + '-' + Date.now() + '@rms.test' });
      assert.equal(result.status, 201);
      employeeIds.push(result.data.employee_id);
    }
    const bodies = [];
    for (const employeeId of employeeIds) {
      const response = await request('/admin/employees/' + employeeId, anita, undefined, 'GET');
      assert.equal(response.status, 200);
      bodies.push(response.data);
    }
    assert.equal((await request('/admin/employees/' + employeeIds[0], anita,
      { ...bodies[0], supervisor_id: employeeIds[0] }, 'PUT')).status, 400);
    const results = await Promise.all([
      request('/admin/employees/' + employeeIds[0], anita, { ...bodies[0], supervisor_id: employeeIds[1] }, 'PUT'),
      request('/admin/employees/' + employeeIds[1], anita, { ...bodies[1], supervisor_id: employeeIds[0] }, 'PUT'),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  });
});
