/**
 * vectorStore.ts — Local OpenSearch HNSW Vector Index client
 *
 * Implements the spec's multimodal spatial floor plan search:
 *   Index: venue-floorplans-multimodal
 *   Dims:  1536  (text-embedding-004 output)
 *   Metric: cosine similarity via HNSW
 *
 * Local dev setup (Docker):
 *   docker run -d --name opensearch \
 *     -p 9200:9200 -p 9600:9600 \
 *     -e "discovery.type=single-node" \
 *     -e "DISABLE_SECURITY_PLUGIN=true" \
 *     opensearchproject/opensearch:2.13.0
 *
 * env: OPENSEARCH_URL=http://localhost:9200
 */

const OPENSEARCH_URL = process.env.OPENSEARCH_URL ?? 'http://localhost:9200';
const INDEX_NAME     = 'venue-floorplans-multimodal';
const VECTOR_DIMS    = 1536;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FloorplanChunk {
  zoneId     : string;
  venueId    : string;
  description: string;
  location   : { lat: number; lng: number };
  isStepFree : boolean;
  phase      : 'ingress' | 'circulation' | 'egress';
  imageUrl   ?: string;
}

export interface SearchHit {
  id      : string;
  score   : number;
  source  : FloorplanChunk;
}

// ── Index management ──────────────────────────────────────────────────────────

/** Create the HNSW vector index if it doesn't already exist */
export async function ensureIndex(): Promise<void> {
  try {
    const checkRes = await fetch(`${OPENSEARCH_URL}/${INDEX_NAME}`, { method: 'HEAD' });
    if (checkRes.ok) return; // Index already exists

    const mapping = {
      settings: {
        index: { knn: true },
      },
      mappings: {
        properties: {
          zone_id    : { type: 'keyword' },
          venue_id   : { type: 'keyword' },
          description: { type: 'text' },
          is_step_free: { type: 'boolean' },
          phase      : { type: 'keyword' },
          location   : { type: 'geo_point' },
          image_url  : { type: 'keyword' },
          // HNSW vector field — cosine similarity, 1536 dims
          floorplan_vector: {
            type      : 'knn_vector',
            dimension : VECTOR_DIMS,
            method    : {
              name           : 'hnsw',
              space_type     : 'cosinesimil',
              engine         : 'nmslib',
              parameters     : { ef_construction: 128, m: 24 },
            },
          },
        },
      },
    };

    await fetch(`${OPENSEARCH_URL}/${INDEX_NAME}`, {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(mapping),
    });

    console.info('[VectorStore] Created index:', INDEX_NAME);
  } catch (err) {
    console.warn('[VectorStore] ensureIndex failed (OpenSearch not running?):', err);
  }
}

/** Upsert a floor plan chunk with its embedding vector */
export async function upsertFloorplanChunk(
  docId    : string,
  embedding: number[],
  metadata : FloorplanChunk,
): Promise<void> {
  if (embedding.length !== VECTOR_DIMS) {
    console.warn(`[VectorStore] Expected ${VECTOR_DIMS} dims, got ${embedding.length}`);
    return;
  }
  try {
    await fetch(`${OPENSEARCH_URL}/${INDEX_NAME}/_doc/${docId}`, {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        zone_id         : metadata.zoneId,
        venue_id        : metadata.venueId,
        description     : metadata.description,
        is_step_free    : metadata.isStepFree,
        phase           : metadata.phase,
        location        : metadata.location,
        image_url       : metadata.imageUrl ?? null,
        floorplan_vector: embedding,
      }),
    });
  } catch (err) {
    console.warn('[VectorStore] upsert failed:', err);
  }
}

/** k-NN semantic search for venue floor plan chunks */
export async function searchFloorplan(
  queryEmbedding: number[],
  venueId       : string,
  topK          : number = 3,
  stepFreeOnly  : boolean = false,
): Promise<SearchHit[]> {
  try {
    const filter: object[] = [{ term: { venue_id: venueId } }];
    if (stepFreeOnly) filter.push({ term: { is_step_free: true } });

    const queryBody = {
      query: {
        bool: {
          must  : [{ knn: { floorplan_vector: { vector: queryEmbedding, k: topK } } }],
          filter,
        },
      },
      size: topK,
    };

    const res = await fetch(`${OPENSEARCH_URL}/${INDEX_NAME}/_search`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(queryBody),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      hits: { hits: { _id: string; _score: number; _source: Record<string, unknown> }[] };
    };

    return (data.hits?.hits ?? []).map(hit => ({
      id    : hit._id,
      score : hit._score,
      source: {
        zoneId     : String(hit._source.zone_id ?? ''),
        venueId    : String(hit._source.venue_id ?? ''),
        description: String(hit._source.description ?? ''),
        isStepFree : Boolean(hit._source.is_step_free),
        phase      : (hit._source.phase ?? 'circulation') as FloorplanChunk['phase'],
        location   : (hit._source.location ?? { lat: 0, lng: 0 }) as { lat: number; lng: number },
        imageUrl   : hit._source.image_url ? String(hit._source.image_url) : undefined,
      },
    }));
  } catch (err) {
    console.warn('[VectorStore] search failed:', err);
    return [];
  }
}
