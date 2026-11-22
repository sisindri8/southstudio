// Structured, privacy-safe logging. One JSON object per line goes to stdout/stderr, which Render's log viewer
// (and any log drain later) can search. It never prints cookies, tokens, keys, e-mail addresses or request bodies.
// Safe in both the Node and Edge runtimes (console only).
type Level = 'info' | 'warn' | 'error';
const SENSITIVE_KEY = /authorization|cookie|token|secret|password|apikey|api_key|service_role|e-?mail|bearer|session/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function clean(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.replace(EMAIL, '[email]').slice(0, 300);
  if (v instanceof Error) return { name: v.name, message: clean(v.message) };
  if (depth > 2) return '[truncated]';
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => clean(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 20)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : clean(x, depth + 1);
    return out;
  }
  return String(v).slice(0, 100);
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(clean(fields) as object) });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}
export const log = {
  info: (event: string, f?: Record<string, unknown>) => emit('info', event, f),
  warn: (event: string, f?: Record<string, unknown>) => emit('warn', event, f),
  error: (event: string, f?: Record<string, unknown>) => emit('error', event, f),
};

// A database/service problem (as opposed to "the row does not exist"). Throwing this makes Next render an error
// page with a 5xx status instead of a 404, and keeps it out of every cache.
export class DbError extends Error {
  constructor(public where: string, cause?: { message?: string; code?: string } | null) {
    super(`Database unavailable (${where})`);
    this.name = 'DbError';
    log.error('db.error', { where, code: cause?.code, message: cause?.message });
  }
}
