/**
 * modelRouter.ts — Budget-Aware AI Model Router
 *
 * Routes queries to the right Gemini model tier based on complexity:
 *   Tier 1 — Deterministic  : gemini-2.5-flash  (fast, cached, factual)
 *   Tier 2 — Contextual     : gemini-2.5-flash  (default, crowd-aware)
 *   Tier 3 — Planning       : gemini-1.5-pro    (multi-step, emergency)
 */

export type QueryComplexity = 'deterministic' | 'contextual' | 'planning';

export interface RouterDecision {
  complexity : QueryComplexity;
  model      : string;
  /** Whether this response should be retrieved from / stored in semantic cache */
  useCache   : boolean;
  /** Gemini system instruction prefix for this tier */
  systemHint : string;
}

// ── Keyword classifiers ───────────────────────────────────────────────────────

const DETERMINISTIC_KEYWORDS = [
  'wait time', 'is open', 'where is', 'capacity', 'how many',
  'what time', 'hours', 'price', 'cost', 'location',
];

const PLANNING_KEYWORDS = [
  'best route', 'emergency', 'evacuate', 'plan', 'if crowd',
  'outbreak', 'fire', 'medical', 'safest', 'what should i do',
  'staff reallocation', 'critical density',
];

/**
 * Classify a user query and return a routing decision.
 *
 * @param query  The raw (already sanitized) user query string
 */
export function classifyQuery(query: string): RouterDecision {
  const q = query.toLowerCase();

  // Tier 1 — Deterministic: Short factual questions
  const isDeterministic =
    DETERMINISTIC_KEYWORDS.some(k => q.includes(k)) && q.length < 80;

  if (isDeterministic) {
    return {
      complexity : 'deterministic',
      model      : 'gemini-2.5-flash',
      useCache   : true,
      systemHint : 'Answer briefly and factually in one sentence.',
    };
  }

  // Tier 3 — Planning: Multi-step reasoning, emergency scenarios
  const isPlanning = PLANNING_KEYWORDS.some(k => q.includes(k));

  if (isPlanning) {
    return {
      complexity : 'planning',
      model      : 'gemini-1.5-pro',
      useCache   : false,
      systemHint : 'Think step-by-step. Prioritize safety above speed. Provide an actionable plan.',
    };
  }

  // Tier 2 — Contextual: General crowd-aware queries (default)
  return {
    complexity : 'contextual',
    model      : 'gemini-2.5-flash',
    useCache   : true,
    systemHint : 'Use current crowd context to give a helpful, concise answer.',
  };
}
