import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';

type Metrics = { [k: string]: number };

const METRICS_FILE = path.join(process.cwd(), '.metrics.json');
let metrics: Metrics = {};

// Load persisted metrics if available (non-fatal)
try {
  if (existsSync(METRICS_FILE)) {
    const raw = readFileSync(METRICS_FILE, 'utf8');
    metrics = JSON.parse(raw) as Metrics;
  }
} catch {
  // ignore
}

export function incrementMetric(name: string, amount = 1) {
  metrics[name] = (metrics[name] || 0) + amount;
  // Persist only when explicitly enabled to avoid noise in test environments.
  // Async write so the request path never blocks the event loop.
  if (process.env.METRICS_PERSIST === '1') {
    writeFile(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf8').catch(() => {
      // ignore
    });
  }
}

export function getMetrics(): Metrics {
  return { ...metrics };
}

/**
 * Reset metrics (test utility).
 */
export function _resetMetrics() {
  metrics = {};
} 
