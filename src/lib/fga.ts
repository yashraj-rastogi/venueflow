/**
 * fga.ts — OpenFGA Relationship-Based Access Control (ReBAC) client
 *
 * Implements the Zanzibar-style authorization model from the spec.
 * The OpenFGA schema lives in openfga/model.fga.
 *
 * Local dev: docker run -d --name openfga -p 8080:8080 openfga/openfga run
 *
 * LLM06 mitigation: No LLM output directly triggers privileged actions.
 *   Every mutating operation (broadcast, amenity toggle) is gated through
 *   a deterministic ReBAC check BEFORE the LLM is involved.
 */
import { OpenFgaClient } from '@openfga/sdk';

// ── Client (singleton) ────────────────────────────────────────────────────────

let _fgaClient: OpenFgaClient | null = null;

function getClient(): OpenFgaClient {
  if (!_fgaClient) {
    _fgaClient = new OpenFgaClient({
      apiUrl             : process.env.OPENFGA_API_URL  ?? 'http://localhost:8080',
      storeId            : process.env.OPENFGA_STORE_ID ?? '',
      authorizationModelId: process.env.OPENFGA_MODEL_ID,
    });
  }
  return _fgaClient;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type FgaObjectType = 'zone' | 'venue' | 'notification';
export type FgaRelation   = 'viewer' | 'editor' | 'owner' | 'staff' | 'admin' | 'can_send';

// ── Core check ────────────────────────────────────────────────────────────────

/**
 * Check if a Firebase UID has a given relationship to a venue/zone object.
 *
 * Fail-open policy for read operations (viewer), fail-closed for writes.
 *
 * @param userId     Firebase Auth UID
 * @param relation   Relationship to check
 * @param objectType Object type in the FGA model
 * @param objectId   Object identifier (e.g. venue ID, zone ID)
 */
export async function checkPermission(
  userId    : string,
  relation  : FgaRelation,
  objectType: FgaObjectType,
  objectId  : string,
): Promise<boolean> {
  if (!userId) return false;

  // No FGA configured → fail-open for viewers, fail-closed for privileged ops
  if (!process.env.OPENFGA_STORE_ID) {
    return relation === 'viewer';
  }

  try {
    const client = getClient();
    // @openfga/sdk v0.7+: check() takes user/relation/object at the top level
    const response = await client.check({
      user    : `user:${userId}`,
      relation,
      object  : `${objectType}:${objectId}`,
    });
    return response.allowed ?? false;
  } catch (err) {
    console.warn('[FGA] Permission check failed:', err);
    // Fail-safe: open for reads, closed for writes
    return relation === 'viewer';
  }
}

// ── Tuple management (for seeding dev environment) ───────────────────────────

/**
 * Grant a user a relationship to an object.
 * Used during dev setup to grant staff roles.
 */
export async function grantRelationship(
  userId    : string,
  relation  : FgaRelation,
  objectType: FgaObjectType,
  objectId  : string,
): Promise<void> {
  if (!process.env.OPENFGA_STORE_ID) return;
  try {
    const client = getClient();
    // @openfga/sdk v0.7+: writes takes a flat TupleKey[] array directly
    await client.write({
      writes: [
        {
          user    : `user:${userId}`,
          relation,
          object  : `${objectType}:${objectId}`,
        },
      ],
    });
  } catch (err) {
    console.warn('[FGA] grantRelationship failed:', err);
  }
}

