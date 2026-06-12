// Optional New Relic sink. The agent is started only when
// NEW_RELIC_LICENSE_KEY is present, so dev and test runs (and any deploy
// without the key) get zero overhead — every exported function is a no-op
// until initTelemetry() has successfully loaded the agent.
//
// Two ways to run in production:
//   1. `npm start` + initTelemetry()      — audit events + errors in New Relic
//   2. `npm run start:apm`                 — same, plus full APM (Express/Mongo
//      auto-instrumentation). Requires NEW_RELIC_* set as real host env vars,
//      because the agent boots before dotenv loads .env.production.

type Attributes = Record<string, string | number | boolean>;

type NewRelicApi = {
  recordCustomEvent: (eventType: string, attributes: Attributes) => void;
  noticeError: (error: Error, customAttributes?: Attributes) => void;
};

let agent: NewRelicApi | null = null;

export const initTelemetry = async (): Promise<void> => {
  if (!process.env.NEW_RELIC_LICENSE_KEY) return;
  // The agent reads its config from NEW_RELIC_* env vars; no newrelic.cjs
  // config file is needed.
  process.env.NEW_RELIC_NO_CONFIG_FILE = process.env.NEW_RELIC_NO_CONFIG_FILE || 'true';
  process.env.NEW_RELIC_APP_NAME = process.env.NEW_RELIC_APP_NAME || 'fitpick-api';
  try {
    // If the process was started with `-r newrelic` (start:apm), this returns
    // the already-running agent; otherwise it boots the agent in API-only mode.
    agent = (await import('newrelic')).default as unknown as NewRelicApi;
  } catch (err) {
    process.stderr.write(`[telemetry] failed to start New Relic agent: ${(err as Error)?.message || err}\n`);
  }
};

// Custom-event attribute values must be primitives; drop empties and
// stringify anything structured (e.g. metadata objects).
const toAttributes = (raw: Record<string, unknown>): Attributes => {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    attributes[key] =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : JSON.stringify(value);
  }
  return attributes;
};

export const recordAuditEvent = (attributes: Record<string, unknown>): void => {
  try {
    agent?.recordCustomEvent('AuditLog', toAttributes(attributes));
  } catch {
    // Telemetry must never break a request.
  }
};

export const noticeError = (error: Error, attributes?: Record<string, unknown>): void => {
  try {
    agent?.noticeError(error, attributes ? toAttributes(attributes) : undefined);
  } catch {
    // Telemetry must never break a request.
  }
};
