import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeInput, scrubOutput } from '@/lib/inputGuard';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    amenityName = 'Amenity',
    currentWait = 5,
    density     = 0.5,
    timeOfDay   = 12,
  } = body;

  // ── OWASP LLM01: Sanitize amenityName ────────────────────────────────────
  const { safe: safeAmenityName, blocked, reason } = sanitizeInput(String(amenityName));
  if (blocked) {
    return NextResponse.json({ ok: false, error: `Input blocked: ${reason}` }, { status: 422 });
  }

  // ── Numeric range validation ───────────────────────────────────────────────
  // ── Numeric range validation ───────────────────────────────────────────────
  const safeDensity  = Math.max(0, Math.min(1, Number(density) || 0.5));
  const safeWait     = Math.max(0, Math.min(120, Number(currentWait) || 5));
  const safeHour     = Math.max(0, Math.min(23, Math.floor(Number(timeOfDay) || 12)));

  try {
    const prompt = `Predict venue amenity wait time in 15 min. Given:
- Amenity: ${safeAmenityName}
- Current wait: ${safeWait} min
- Zone density: ${(safeDensity * 100).toFixed(0)}%
- Time of day: ${safeHour}:00
Return ONLY valid JSON: {"predictedWait":number,"confidence":number,"trend":"increasing"|"stable"|"decreasing","reasoning":"brief"}`;

    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();
    const json   = raw.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const data   = JSON.parse(json);

    // ── OWASP LLM02: Scrub reasoning output ──────────────────────────────
    data.reasoning = scrubOutput(String(data.reasoning ?? ''));

    return NextResponse.json(data);
  } catch {
    const delta = safeDensity > 0.7 ? 2 : safeDensity < 0.3 ? -2 : 0;
    return NextResponse.json({
      predictedWait: Math.max(0, safeWait + delta),
      confidence   : 0.6,
      trend        : delta > 0 ? 'increasing' : delta < 0 ? 'decreasing' : 'stable',
      reasoning    : 'Heuristic estimate based on density',
    });
  }
}
