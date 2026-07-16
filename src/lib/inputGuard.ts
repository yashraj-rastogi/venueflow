/**
 * inputGuard.ts — OWASP LLM Top 10 (2025) input/output security layer
 *
 * LLM01 — Prompt Injection: sanitize and validate all user inputs before
 *          they reach any Gemini API call.
 * LLM02 — Sensitive Information Disclosure: scrub PII and PCI data from
 *          all LLM outputs before returning to the client.
 * LLM06 — Excessive Agency: handled separately via OpenFGA ReBAC (see fga.ts).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SanitizeResult {
  /** The cleaned, safe input string */
  safe: string;
  /** Whether the input was blocked (do not send to LLM) */
  blocked: boolean;
  /** Human-readable reason for blocking (omitted when not blocked) */
  reason?: string;
}

// ── LLM01: Prompt Injection Guard ────────────────────────────────────────────

const MAX_INPUT_LENGTH = 500;

/**
 * Known prompt-injection patterns from OWASP LLM Top 10 (2025) and red-team datasets.
 * Each entry is a [pattern, friendlyName] pair for debugging.
 */
const INJECTION_PATTERNS: [RegExp, string][] = [
  [/ignore\s+(all\s+)?previous\s+instructions?/i, 'ignore-instructions'],
  [/you\s+are\s+now\s+a\b/i,                      'persona-switch'],
  [/act\s+as\s+(a|an)\s+/i,                        'act-as'],
  [/system\s*:/i,                                  'system-prefix'],
  [/\[INST\]/i,                                    'llama-inst-tag'],
  [/<\|im_start\|>/i,                              'chatml-tag'],
  [/jailbreak/i,                                   'jailbreak-keyword'],
  [/dan\s+mode/i,                                  'dan-mode'],
  [/bypass\s+(all\s+)?(safety|filter)/i,            'bypass-safety'],
  [/reveal\s+(your|the)\s+(system\s+)?prompt/i,    'prompt-exfil'],
];

/**
 * Sanitize a user-provided string before sending to any LLM endpoint.
 *
 * @param raw  The raw string from the user (chat input, amenity name, etc.)
 * @returns    SanitizeResult — check `.blocked` before using `.safe`
 */
export function sanitizeInput(raw: string): SanitizeResult {
  if (!raw || typeof raw !== 'string') {
    return { safe: '', blocked: true, reason: 'Input must be a non-empty string' };
  }

  // Length guard
  if (raw.length > MAX_INPUT_LENGTH) {
    return {
      safe   : '',
      blocked: true,
      reason : `Input exceeds ${MAX_INPUT_LENGTH} character limit (got ${raw.length})`,
    };
  }

  // Injection pattern scan
  for (const [pattern, label] of INJECTION_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        safe   : '',
        blocked: true,
        reason : `Prompt injection pattern detected: ${label}`,
      };
    }
  }

  // Strip dangerous formatting characters that could alter prompt structure
  const safe = raw
    .replace(/[<>]/g, '')           // HTML tags
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/#{1,6}\s/g, '')       // markdown headings
    .trim();

  return { safe, blocked: false };
}

// ── LLM02: PII / PCI Output Scrubber ─────────────────────────────────────────

/**
 * Patterns and their redaction labels for sensitive data in LLM outputs.
 */
const PII_PATTERNS: [RegExp, string][] = [
  // Credit card numbers (16 digits, optional separators)
  [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[REDACTED-CARD]'],
  // Social Security Numbers
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]'],
  // Email addresses
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED-EMAIL]'],
  // US phone numbers (various formats)
  [/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED-PHONE]'],
  // Passport numbers (generic 6–9 alphanumeric)
  [/\b[A-Z]{1,2}\d{6,9}\b/g, '[REDACTED-PASSPORT]'],
  // API keys / secrets (long alphanumeric strings that look like keys)
  [/\b(sk|pk|api|key|token|secret)[-_][a-zA-Z0-9]{20,}\b/gi, '[REDACTED-KEY]'],
];

/**
 * Scrub PII and PCI data from a raw LLM output string before returning to client.
 *
 * @param raw  The raw text output from the LLM
 * @returns    Scrubbed text safe to return to the client
 */
export function scrubOutput(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  let scrubbed = raw;
  for (const [pattern, label] of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, label);
  }
  return scrubbed;
}
