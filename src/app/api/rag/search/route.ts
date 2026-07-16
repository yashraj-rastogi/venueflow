import { NextRequest, NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/inputGuard';
import { searchFloorplan } from '@/lib/vectorStore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

/** Generate a text embedding using Gemini's text-embedding-004 */
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result     = await embedModel.embedContent(text);
    return result.embedding.values;
  } catch {
    return []; // Fall back to empty embedding — search returns 0 results
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, venueId, topK = 3, stepFreeOnly = false } = body;

    if (!query || !venueId) {
      return NextResponse.json({ ok: false, error: 'query and venueId are required' }, { status: 400 });
    }

    // ── OWASP LLM01: sanitize query ────────────────────────────────────────
    const { safe, blocked, reason } = sanitizeInput(String(query));
    if (blocked) {
      return NextResponse.json({ ok: false, error: `Query blocked: ${reason}` }, { status: 422 });
    }

    // ── Generate query embedding ───────────────────────────────────────────
    const embedding = await getEmbedding(safe);

    // ── k-NN search against OpenSearch ────────────────────────────────────
    const hits = await searchFloorplan(embedding, venueId, topK, stepFreeOnly);

    // ── Format context for RAG ─────────────────────────────────────────────
    const context = hits.map(h =>
      `Zone: ${h.source.zoneId} | ${h.source.description}` +
      (h.source.isStepFree ? ' [Step-Free]' : '') +
      ` | Phase: ${h.source.phase}`
    ).join('\n');

    return NextResponse.json({ ok: true, hits, context });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
