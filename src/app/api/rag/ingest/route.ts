import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ensureIndex, upsertFloorplanChunk } from '@/lib/vectorStore';
import { SAMPLE_VENUES } from '@/lib/sampleData';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

/** Generate a text embedding using Gemini text-embedding-004 (1536 dims) */
async function embed(text: string): Promise<number[]> {
  const model  = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * POST /api/rag/ingest
 * Ingests all zones from SAMPLE_VENUES into the OpenSearch HNSW vector index.
 * Call once after starting local OpenSearch (docker compose up -d opensearch).
 *
 * Protected: only callable with a valid admin Authorization header.
 */
export async function POST(req: NextRequest) {
  // Lightweight admin guard — real auth via Firebase token in production
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.INGEST_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure the HNSW index exists before ingesting
    await ensureIndex();

    let ingested = 0;
    const errors: string[] = [];

    for (const venue of SAMPLE_VENUES) {
      for (const zone of venue.zones) {
        // Build a rich text description for embedding
        const description = [
          `${zone.name} in ${venue.name}, ${venue.city}.`,
          `Capacity: ${zone.capacity} people.`,
          `DIM-ICE phase: ${zone.phase ?? 'circulation'}.`,
          zone.isStepFree
            ? 'Step-free access: yes — wheelchair accessible, elevator or ramp route available.'
            : 'Step-free access: no — stairs or escalators required.',
          `Egress width: ${zone.egressWidthM ?? 'unknown'} metres.`,
          `Floor area: ${zone.areaM2 ?? 'unknown'} m².`,
          venue.riskProfile?.climateRisks.length
            ? `Climate risks: ${venue.riskProfile.climateRisks.join(', ')}.`
            : '',
        ].filter(Boolean).join(' ');

        try {
          const embedding = await embed(description);
          const docId     = `${venue.id}--${zone.id}`;

          await upsertFloorplanChunk(docId, embedding, {
            zoneId     : zone.id,
            venueId    : venue.id,
            description,
            location   : zone.coordinates[0] ?? { lat: venue.lat, lng: venue.lng },
            isStepFree : zone.isStepFree ?? false,
            phase      : zone.phase ?? 'circulation',
          });

          ingested++;
        } catch (zoneErr) {
          errors.push(`${venue.id}/${zone.id}: ${String(zoneErr)}`);
        }
      }
    }

    return NextResponse.json({
      ok        : true,
      ingested,
      errors    : errors.length ? errors : undefined,
      totalZones: SAMPLE_VENUES.reduce((s, v) => s + v.zones.length, 0),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
