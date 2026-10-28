import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import test from 'node:test';
import { pool, query, transaction } from '../src/db.js';
import { performanceHeaders } from '../src/timing.js';

test('performance headers track database operations independently for each request', async (t) => {
  let released = 0;
  t.mock.method(pool, 'getConnection', async () => {
    await delay(15);
    return {
      async query(sql) {
        await delay(sql === 'SLOW' ? 40 : 10);
        if (sql === 'FAIL') throw new Error('Simulated database error');
        return [[{ ok: true }]];
      },

      async execute() {
        await delay(10);
        return [[{ ok: true }]];
      },

      async beginTransaction() {
        await delay(5);
      },

      async commit() {
        await delay(5);
      },

      async rollback() {
        await delay(5);
      },

      release() {
        released += 1;
      },
    };
  });
  const app = express();
  app.use(performanceHeaders);
  app.use(express.json());
  app.get('/none', (req, res) => res.json({ ok: true }));
  app.post('/query', async (req, res) => res.json(await query('SELECT private_value')));
  app.get('/slow', async (req, res) => res.json(await query('SLOW')));
  app.get('/parallel', async (req, res) => res.json(await Promise.all([query('SELECT 1'), query('SELECT 2')])));
  app.get('/transaction', async (req, res) => {
    await transaction(async (conn) => {
      await conn.query('SELECT private_value');
      await conn.execute('SELECT private_value');
    });
    res.json({ ok: true });
  });
  app.get('/rollback', async (req, res) => {
    try {
      await transaction((conn) => conn.query('FAIL'));
    } catch {
      res.status(400).json({ error: 'Expected test failure' });
    }
  });
  app.get('/failed-query', async (req, res) => {
    try {
      await query('FAIL');
    } catch {
      res.status(400).json({ error: 'Expected test failure' });
    }
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;

  async function request(path, count, method = 'GET') {
    const response = await fetch(base + path, {
      method,
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
    });
    await response.json();
    assert.equal(Number(response.headers.get('X-DB-Query-Count')), count);
    for (const header of ['X-DB-Time-Ms', 'X-DB-Pool-Wait-Ms', 'X-Response-Time-Ms']) {
      assert.match(response.headers.get(header), /^\d+\.\d{3}$/);
    }
    assert.match(response.headers.get('Server-Timing'), /db;dur=.*db_pool;dur=.*app;dur=/);
    assert.doesNotMatch(response.headers.get('Server-Timing'), /private_value/);
    if (count) {
      assert.ok(Number(response.headers.get('X-DB-Time-Ms')) >= 5);
      assert.ok(Number(response.headers.get('X-DB-Pool-Wait-Ms')) >= 10);
    } else {
      assert.equal(response.headers.get('X-DB-Time-Ms'), '0.000');
      assert.equal(response.headers.get('X-DB-Pool-Wait-Ms'), '0.000');
    }
    return response;
  }

  await t.test('requests without database access report zero', () => request('/none', 0));
  await t.test('ordinary POST queries include database time after JSON body parsing', () => request('/query', 1, 'POST'));
  await t.test('transaction statements and commit are included', () => request('/transaction', 4));
  await t.test('failed statements and rollback are included on error responses', async () => {
    assert.equal((await request('/rollback', 3)).status, 400);
    assert.equal((await request('/failed-query', 1)).status, 400);
  });
  await t.test('parallel queries and overlapping requests do not mix counters', () => Promise.all([
    request('/slow', 1), request('/query', 1, 'POST'), request('/parallel', 2), request('/none', 0),
  ]));
  assert.equal(released, 8);
});
