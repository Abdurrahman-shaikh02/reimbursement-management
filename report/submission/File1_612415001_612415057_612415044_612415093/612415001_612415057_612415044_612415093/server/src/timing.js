import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

// Each async request chain owns its counters, including parallel queries.
const requestTiming = new AsyncLocalStorage();

export async function measureDatabase(operation, waitingForConnection = false) {
  const timing = requestTiming.getStore();
  if (!timing) return operation();
  const start = performance.now();
  if (!waitingForConnection) timing.queryCount += 1;
  try {
    return await operation();
  } finally {
    // Failed queries and rollbacks still consume database time.
    const key = waitingForConnection ? 'poolMs' : 'databaseMs';
    timing[key] += performance.now() - start;
  }
}

export function performanceHeaders(req, res, next) {
  const timing = { startedAt: performance.now(), databaseMs: 0, poolMs: 0, queryCount: 0 };
  const writeHead = res.writeHead;

  // Emit metrics just before headers are sent, including error responses.
  res.writeHead = function (...args) {
    const totalMs = (performance.now() - timing.startedAt).toFixed(3);
    const databaseMs = timing.databaseMs.toFixed(3);
    const poolMs = timing.poolMs.toFixed(3);
    res.setHeader('X-DB-Time-Ms', databaseMs);
    res.setHeader('X-DB-Pool-Wait-Ms', poolMs);
    res.setHeader('X-DB-Query-Count', String(timing.queryCount));
    res.setHeader('X-Response-Time-Ms', totalMs);
    res.append('Server-Timing', [
      'db;dur=' + databaseMs + ';desc="Database round trips"',
      'db_pool;dur=' + poolMs + ';desc="Database connection acquisition"',
      'app;dur=' + totalMs + ';desc="Request processing"',
    ].join(', '));
    return writeHead.apply(this, args);
  };

  requestTiming.run(timing, next);
}
