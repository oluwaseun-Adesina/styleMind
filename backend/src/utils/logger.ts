import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { recordAuditEvent, noticeError } from './telemetry.js';

// Central logger. Replaces direct console.* usage so production stays quiet:
//
//   level   | console (dev/test)        | console (production) | database
//   --------|---------------------------|----------------------|--------------------
//   debug   | yes                       | no                   | never
//   info    | yes                       | no                   | never
//   warn    | yes                       | no                   | production only
//   error   | yes (stderr)              | yes (stderr)         | production only
//   audit   | yes                       | no                   | always (except test)
//
// Errors still reach stderr in production on purpose: a fatal failure (e.g.
// the database itself being down) must not vanish just because the DB sink
// is unavailable.

const isProduction = () => process.env.NODE_ENV === 'production';
const isTest = () => process.env.NODE_ENV === 'test';

type Metadata = Record<string, unknown>;

export type AuditDetails = {
  userId?: string;
  ip?: string;
  message?: string;
  metadata?: Metadata;
};

// Serialize Error objects so stacks survive the trip into Mixed metadata.
const toMetadata = (meta?: Metadata | Error): Metadata | undefined => {
  if (!meta) return undefined;
  if (meta instanceof Error) {
    return { error: meta.message, stack: meta.stack };
  }
  return meta;
};

const persist = (entry: {
  level: 'audit' | 'warn' | 'error';
  category: string;
  action: string;
  message?: string;
  uid?: string;
  ip?: string;
  metadata?: Metadata;
}): void => {
  if (isTest()) return;

  // Mirror to New Relic (no-op unless the agent is configured). Independent
  // of MongoDB, so entries still reach New Relic if the DB is down.
  recordAuditEvent({
    level: entry.level,
    category: entry.category,
    action: entry.action,
    message: entry.message,
    uid: entry.uid,
    ip: entry.ip,
    metadata: entry.metadata,
  });

  // Fire-and-forget: logging must never block or fail a request. Skip when
  // the connection isn't ready (boot, shutdown) instead of queueing writes.
  if (mongoose.connection.readyState !== 1) return;
  AuditLog.create(entry).catch((err) => {
    // Last resort — a failed log write must not recurse into the logger.
    process.stderr.write(`[logger] failed to persist log entry: ${err?.message || err}\n`);
  });
};

export const logger = {
  debug(message: string, meta?: Metadata | Error): void {
    if (isProduction()) return;
    console.log(message, ...(meta ? [toMetadata(meta)] : []));
  },

  info(message: string, meta?: Metadata | Error): void {
    if (isProduction()) return;
    console.log(message, ...(meta ? [toMetadata(meta)] : []));
  },

  warn(message: string, meta?: Metadata | Error): void {
    if (!isProduction()) {
      console.warn(message, ...(meta ? [toMetadata(meta)] : []));
    } else {
      persist({ level: 'warn', category: 'app', action: 'app.warning', message, metadata: toMetadata(meta) });
    }
  },

  error(message: string, meta?: Metadata | Error): void {
    console.error(message, ...(meta ? [toMetadata(meta)] : []));
    if (meta instanceof Error) {
      // Real Error objects go to New Relic Errors Inbox with their stack.
      noticeError(meta, { message });
    }
    if (isProduction()) {
      persist({ level: 'error', category: 'app', action: 'app.error', message, metadata: toMetadata(meta) });
    }
  },

  /**
   * Record a user-visible action in the audit trail, e.g.
   * `logger.audit('wardrobe.item_added', { userId, ip, metadata: { itemId } })`.
   * The category is the part of the action before the first dot.
   */
  audit(action: string, details: AuditDetails = {}): void {
    const category = action.split('.')[0] || 'app';
    if (!isProduction()) {
      console.log(`[audit] ${action}`, { ...details });
    }
    persist({
      level: 'audit',
      category,
      action,
      message: details.message,
      uid: details.userId,
      ip: details.ip,
      metadata: details.metadata,
    });
  },
};
