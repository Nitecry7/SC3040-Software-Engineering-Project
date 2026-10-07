import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

const BUCKET_NAME = 'property-images';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type StorageEntry = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getAdminKey(): string {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey) return serviceRoleKey;

  const secretKeys = getConfiguredSecretKeys();
  if (secretKeys.length === 0) {
    throw new Error('No Supabase server key is configured');
  }

  return secretKeys[0];
}

function getConfiguredSecretKeys(): string[] {
  const keys = new Set<string>();
  const legacyServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyServiceRoleKey) keys.add(legacyServiceRoleKey);

  const rawSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (rawSecretKeys) {
    try {
      const parsedSecretKeys = JSON.parse(rawSecretKeys) as Record<string, unknown>;
      Object.values(parsedSecretKeys).forEach(key => {
        if (typeof key === 'string' && key.length > 0) keys.add(key);
      });
    } catch {
      console.warn('SUPABASE_SECRET_KEYS is not valid JSON');
    }
  }

  return [...keys];
}

function extractStoragePath(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;

  const rawValue = value.trim();
  const publicMarker = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const signedMarker = `/storage/v1/object/sign/${BUCKET_NAME}/`;

  try {
    const pathname = new URL(rawValue).pathname;
    const marker = pathname.includes(publicMarker) ? publicMarker : signedMarker;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex >= 0) {
      return decodeURIComponent(pathname.slice(markerIndex + marker.length));
    }
  } catch {
    // The database may contain a legacy external URL or a storage path.
  }

  if (rawValue.startsWith(`${BUCKET_NAME}/`)) {
    return rawValue.slice(BUCKET_NAME.length + 1);
  }

  // Keep external URLs and historical image URLs out of the linked-path set.
  return null;
}

function addLinkedPath(linkedPaths: Set<string>, value: unknown) {
  const path = extractStoragePath(value);
  if (path) linkedPaths.add(path);
}

async function listAllObjectPaths(
  storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>,
  path = '',
): Promise<string[]> {
  const objectPaths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await storage.list(path, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    const entries = (data || []) as StorageEntry[];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;
      const isFolder = !entry.id && !entry.metadata;

      if (isFolder) {
        objectPaths.push(...await listAllObjectPaths(storage, fullPath));
      } else {
        objectPaths.push(fullPath);
      }
    }

    if (entries.length < 1000) break;
    offset += entries.length;
  }

  return objectPaths;
}

async function cleanupUnlinkedImages() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = getAdminKey();

  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');

  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = adminClient.storage.from(BUCKET_NAME);

  const { data: properties, error: propertyError } = await adminClient
    .from('properties')
    .select('image_url, photos');

  if (propertyError) throw propertyError;

  const linkedPaths = new Set<string>();
  for (const property of properties || []) {
    addLinkedPath(linkedPaths, property.image_url);
    if (Array.isArray(property.photos)) {
      property.photos.forEach((photo: unknown) => addLinkedPath(linkedPaths, photo));
    }
  }

  const allObjectPaths = await listAllObjectPaths(storage);
  const unlinkedPaths = allObjectPaths.filter(path => !linkedPaths.has(path));

  let deletedCount = 0;
  for (let index = 0; index < unlinkedPaths.length; index += 100) {
    const batch = unlinkedPaths.slice(index, index + 100);
    const { error: deleteError } = await storage.remove(batch);
    if (deleteError) throw deleteError;
    deletedCount += batch.length;
  }

  return {
    bucket: BUCKET_NAME,
    linkedCount: linkedPaths.size,
    scannedCount: allObjectPaths.length,
    deletedCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = req.headers.get('apikey');
    const authorization = req.headers.get('Authorization');
    const suppliedKey = apiKey || authorization?.replace(/^Bearer\s+/i, '');
    const allowedKeys = getConfiguredSecretKeys();

    if (!suppliedKey || !allowedKeys.includes(suppliedKey)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    return jsonResponse({ ok: true, ...(await cleanupUnlinkedImages()) });
  } catch (error) {
    console.error('Property image cleanup failed:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Property image cleanup failed',
    }, 500);
  }
});
