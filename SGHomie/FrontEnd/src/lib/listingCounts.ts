import type { SupabaseClient } from '@supabase/supabase-js';

export interface ListingCounts {
  properties: number;
  locations: number;
}

// Read public catalog fields through the caller's RLS-protected client. Paginate
// so the database response limit cannot silently truncate the town count.
export async function loadListingCounts(client: Pick<SupabaseClient, 'from'>, signal: AbortSignal): Promise<ListingCounts> {
  const towns = new Set<string>();
  let properties = 0;
  const pageSize = 500;
  for (;;) {
    const { data, error, count } = await client.from('properties')
      .select('id,town,location', { count: 'exact' })
      .eq('status', 'approved').eq('type', 'HDB')
      .order('id').range(properties, properties + pageSize - 1)
      .abortSignal(signal);
    if (error) throw error;
    if (!data?.length) {
      if (count !== null && properties < count) throw new Error('Incomplete listing counts');
      break;
    }
    for (const row of data) {
      const town = (row.town?.trim() || row.location?.trim() || '').toUpperCase();
      if (town && town !== 'PENDING') towns.add(town);
    }
    properties += data.length;
    if (count !== null ? properties >= count : data.length < pageSize) break;
  }
  return { properties, locations: towns.size };
}
