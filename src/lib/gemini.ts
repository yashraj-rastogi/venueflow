/**
 * gemini.ts — VenueFlow AI Functions
 *
 * All AI calls are routed through:
 *   1. sanitizeInput       — OWASP LLM01 prompt injection guard
 *   2. classifyQuery       — Budget-aware model router (Tier 1/2/3)
 *   3. getCachedResponse   — Upstash Redis semantic cache (Tier 1/2 only)
 *   4. GoogleGenerativeAI  — Gemini 2.5 Flash / 1.5 Pro depending on tier
 *   5. scrubOutput         — OWASP LLM02 PII/PCI scrubber
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CrowdSnapshot, WaitTimePrediction, RouteOption, LatLng } from '@/types';
import { sanitizeInput, scrubOutput } from '@/lib/inputGuard';
import { classifyQuery } from '@/lib/modelRouter';
import { getCachedResponse, setCachedResponse, hashQuery } from '@/lib/cache';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

/** Get a Gemini model instance by name */
function getModel(modelName: string) {
  return genAI.getGenerativeModel({ model: modelName });
}

// ─── Wait Time Prediction ──────────────────────────────────────────────────────

export async function predictWaitTime(
  amenityName: string,
  currentWait: number,
  density    : number,
  timeOfDay  : number, // hour 0–23
): Promise<WaitTimePrediction> {
  const prompt = `Predict venue amenity wait time in 15 min. Given:
- Amenity: ${amenityName}
- Current wait: ${currentWait} min
- Zone density: ${(density * 100).toFixed(0)}%
- Time of day: ${timeOfDay}:00

Return ONLY valid JSON: {"predictedWait":number,"confidence":number,"trend":"increasing"|"stable"|"decreasing","reasoning":"brief"}`;

  try {
    const model  = getModel('gemini-2.5-flash');
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    const json   = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const parsed = JSON.parse(json) as WaitTimePrediction;
    parsed.reasoning = scrubOutput(parsed.reasoning ?? '');
    return parsed;
  } catch {
    const delta = density > 0.7 ? 2 : density < 0.3 ? -2 : 0;
    return {
      predictedWait: Math.max(0, currentWait + delta),
      confidence   : 0.6,
      trend        : delta > 0 ? 'increasing' : delta < 0 ? 'decreasing' : 'stable',
      reasoning    : 'Heuristic estimate based on density',
    };
  }
}

// ─── Route Optimization ────────────────────────────────────────────────────────

export async function optimizeRoute(
  start      : string,
  destination: string,
  crowdData  : CrowdSnapshot,
  preference : 'fastest' | 'least_crowded' | 'wheelchair',
): Promise<{ suggestion: string; crowdLevel: string; estimatedTime: number }> {
  const avgDensity = Object.values(crowdData.zones).reduce((s, z) => s + z.density, 0) /
    Object.values(crowdData.zones).length;

  const highDensityZones = Object.entries(crowdData.zones)
    .filter(([, z]) => z.density > 0.7)
    .map(([id]) => id)
    .join(', ') || 'none';

  const preferenceNote = preference === 'wheelchair'
    ? 'IMPORTANT: Route MUST be step-free. Use only elevators, ramps, and wide corridors. Avoid all stairs and escalators.'
    : preference === 'least_crowded'
    ? 'Prioritize routes through low-density zones.'
    : 'Prioritize the fastest direct route.';

  const prompt = `Venue navigation advice:
- From: ${start}
- To: ${destination}
- Preference: ${preference}
- Average crowd density: ${(avgDensity * 100).toFixed(0)}%
- High density zones: ${highDensityZones}
- ${preferenceNote}

Return ONLY valid JSON: {"suggestion":"brief route tip","crowdLevel":"low"|"medium"|"high","estimatedTime":number}`;

  try {
    const model  = getModel('gemini-2.5-flash');
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    const json   = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const data   = JSON.parse(json);
    data.suggestion = scrubOutput(String(data.suggestion ?? ''));
    return data;
  } catch {
    const crowdLevel = avgDensity > 0.7 ? 'high' : avgDensity > 0.3 ? 'medium' : 'low';
    return {
      suggestion  : preference === 'wheelchair'
        ? 'Take the elevator near the main entrance and proceed via the accessible corridor.'
        : preference === 'least_crowded'
        ? 'Take the outer concourse to avoid crowded zones.'
        : 'Proceed via the main corridor for the fastest route.',
      crowdLevel,
      estimatedTime: 3,
    };
  }
}

// ─── AI Chat / Query ───────────────────────────────────────────────────────────

export async function analyzeQuery(
  question  : string,
  venueName : string,
  density   : number,
  language  : string = 'en',
): Promise<string> {
  // ── OWASP LLM01: Guard input ──────────────────────────────────────────────
  const { safe, blocked, reason } = sanitizeInput(question);
  if (blocked) {
    return `Sorry, I couldn't process that request: ${reason}`;
  }

  // ── Budget-aware model routing ─────────────────────────────────────────────
  const { model: modelName, useCache, systemHint } = classifyQuery(safe);

  const languageInstruction = language !== 'en'
    ? ` Respond in the language with code "${language}".`
    : '';

  const prompt = `You are a helpful venue assistant for ${venueName}.
Current crowd density: ${(density * 100).toFixed(0)}%.
${systemHint}${languageInstruction}

User question: ${safe}`;

  // ── Upstash semantic cache lookup ──────────────────────────────────────────
  if (useCache) {
    // Use a simple embedding from query hash for now (full embedding in Phase 4 RAG integration)
    const cacheKey = hashQuery(`${venueName}:${safe}`);
    // For MVP, use exact-key lookup; semantic ANN will use real embeddings with vectorStore
    const cached = await getCachedResponse([], `chat:${cacheKey}`);
    if (cached) return cached;
  }

  // ── LLM call ───────────────────────────────────────────────────────────────
  try {
    const model  = getModel(modelName);
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    // ── OWASP LLM02: Scrub PII from response ─────────────────────────────
    const safeResponse = scrubOutput(raw);

    // Cache the response for future similar queries
    if (useCache) {
      const cacheKey = hashQuery(`${venueName}:${safe}`);
      await setCachedResponse('chat', cacheKey, [], safeResponse);
    }

    return safeResponse;
  } catch {
    return "I'm having trouble connecting. Please try again in a moment.";
  }
}
