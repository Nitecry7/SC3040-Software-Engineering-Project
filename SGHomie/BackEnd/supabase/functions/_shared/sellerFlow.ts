// Public chat protocol. Every value received back from the browser is validated;
// ownership and address verification are enforced again by the server on save.
export interface SellerDetails {
  unit_number: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqft: number | null;
  description: string | null;
  seller_name: string | null;
  seller_phone: string | null;
}

export interface SellerContext {
  stage: 'postal' | 'details' | 'price' | 'complete';
  draft_id: string;
  postal_code: string | null;
  details: SellerDetails;
  title: string | null;
  suggested_price: number | null;
}

export interface SellerDraftCard {
  id: string;
  title: string;
  location: string;
  price: number | null;
  missing_fields: string[];
}

export interface SellerFlowEvent {
  context: SellerContext | null;
  draft?: SellerDraftCard;
}

export const emptySellerDetails = (): SellerDetails => ({
  unit_number: null, bedrooms: null, bathrooms: null, area_sqft: null,
  description: null, seller_name: null, seller_phone: null,
});

export function sellerText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

export function sellerNumber(value: unknown, max: number, integer = false): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max
    && (!integer || Number.isInteger(value)) ? value : null;
}

export function parseSellerDetails(value: unknown): SellerDetails {
  const d = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const unit = sellerText(d.unit_number, 15);
  const phone = sellerText(d.seller_phone, 30)?.replace(/[\s().-]/g, '') ?? null;
  return {
    unit_number: unit && /^#?\d{1,3}-\d{1,4}$/.test(unit) ? `#${unit.replace(/^#/, '')}` : null,
    bedrooms: sellerNumber(d.bedrooms, 20, true),
    bathrooms: sellerNumber(d.bathrooms, 20, true),
    area_sqft: sellerNumber(d.area_sqft, 20000),
    // Unit numbers belong only in property_private_details, never public copy.
    description: sellerText(sellerText(d.description, 4000)?.replace(/#?\b\d{1,3}-\d{1,4}\b/g, '').trim(), 4000),
    seller_name: sellerText(d.seller_name, 100),
    seller_phone: phone && /^(?:\+\d{8,15}|[689]\d{7})$/.test(phone)
      ? (phone.startsWith('+') ? phone : `+65${phone}`) : null,
  };
}

export function parseSellerContext(value: unknown): SellerContext {
  if (typeof value !== 'object' || value === null) throw new Error('seller_context must be an object');
  const c = value as Record<string, unknown>;
  if (!['postal', 'details', 'price', 'complete'].includes(String(c.stage))
    || typeof c.draft_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(c.draft_id)
    || (c.postal_code !== null && (typeof c.postal_code !== 'string' || !/^\d{6}$/.test(c.postal_code)))) {
    throw new Error('Invalid seller_context');
  }
  if (c.stage !== 'postal' && c.postal_code === null) throw new Error('A seller postal code is required');
  return { stage: c.stage as SellerContext['stage'], draft_id: c.draft_id, postal_code: c.postal_code as string | null,
    details: parseSellerDetails(c.details), title: sellerText(c.title, 120), suggested_price: sellerNumber(c.suggested_price, 10000000) };
}
