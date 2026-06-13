// src/logger.js
import fs from 'fs';
import path from 'path';

/**
 * Create a structured logger for a specific orderId.
 * Each logger writes to:
 *   Logs/<orderId>/order-<orderId>-<timestamp>.log
 */
export function createOrderLogger(orderId) {
  if (!orderId) {
    throw new Error('orderId is required for logger');
  }

  const rootLogsDir = path.join(process.cwd(), 'Logs');
  const orderDir = path.join(rootLogsDir, String(orderId));

  // Ensure folders exist
  fs.mkdirSync(orderDir, { recursive: true });

  const timestamp = formatTimestamp(new Date());
  const logFileName = `order-${orderId}-${timestamp}.log`;
  const logFilePath = path.join(orderDir, logFileName);

  function write(level, message, extra = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...extra,
    };
    const line = JSON.stringify(entry) + '\n';

    fs.appendFileSync(logFilePath, line, { encoding: 'utf8' });

    // Also echo to console in non-production runs
    if (process.env.NODE_ENV !== 'production') {
      // Simple console mirror
      console.log(`[${level}] ${message}`, Object.keys(extra).length ? extra : '');
    }
  }

  return {
    filePath: logFilePath,
    dirPath: orderDir,

    info: (message, extra) => write('INFO', message, extra),
    step: (message, extra) => write('STEP', message, extra),
    error: (message, extra) => write('ERROR', message, extra),
  };
}

/**
 * Convert a Date to safe file-name format: 2025-12-10_15-32-18
 */
function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    '_' +
    pad(date.getHours()) +
    '-' +
    pad(date.getMinutes()) +
    '-' +
    pad(date.getSeconds())
  );
}
