import { ListingQueryError, parseListingFilters, TOWNS, type ListingFilters } from '../_shared/listings.ts';
import type { ChatCompletionMessageParam } from '../_shared/openrouter.ts';

type ExplicitFilters = Pick<ListingFilters, 'locations' | 'min_price' | 'max_price' | 'room_type'>;
const MONEY = '(?:S\\$|SGD\\s*|\\$)?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m|million|thousand)?\\b';
const amount = (match: RegExpMatchArray): number => Number(match[1].replaceAll(',', ''))
  * (/^(?:m|million)$/i.test(match[2] ?? '') ? 1_000_000 : /^(?:k|thousand)$/i.test(match[2] ?? '') ? 1_000 : 1);
const isMoney = (match: RegExpMatchArray, text: string): boolean => {
  const after = text.slice((match.index ?? 0) + match[0].length).trimStart();
  if (/^(?:bedrooms?|rooms?|bathrooms?|sqft|sqm|sq[ .]?(?:ft|m)|met(?:er|re)s?|minutes?|mins?|years?)\b/i.test(after)) return false;
  return amount(match) >= 10000 || /S\$|SGD|\$|budget|price/i.test(match[0]) || Boolean(match[2]);
};
const townPattern = new RegExp(`\\b(?:${TOWNS.map(town => town.replaceAll(' ', '\\s+')).join('|')}|AMK)\\b`, 'gi');
const canonicalTown = (value: string) => value.toUpperCase() === 'AMK' ? 'ANG MO KIO' : value.toUpperCase().replace(/\s+/g, ' ');
// Recognize a removal applied to a list ("don't really need Bukit Merah or
// 3-room"), without treating a later replacement ("but find 4-room") as removed.
const preferenceList = `(?:${TOWNS.map(town => town.replaceAll(' ', '\\s+')).join('|')}|AMK|[2-5][ -]?room|executives?)`;
const removalPrefix = new RegExp(`\\b(?:no (?:longer )?need|don['’]t(?: really)? need|do not(?: really)? need|remove|drop|clear|go beyond)\\s*(?:the\\s+)?(?:${preferenceList}(?:\\s+(?:homes?|flats?|listings?))?\\s*(?:(?:and|or|,|/)\\s*)?)*$`, 'i');

// The profile UI saves towns and HDB room types. Income/family size are not
// explicit search constraints and must not become an inferred budget or flat type.
export function profileListingFilters(profile: { preferred_locations?: unknown; preferred_property_type?: unknown } | null): ListingFilters | undefined {
  const filters: Partial<ListingFilters> = {};
  if (Array.isArray(profile?.preferred_locations)) {
    const locations = [...new Set(profile.preferred_locations.filter((town): town is string => typeof town === 'string')
      .map(town => canonicalTown(town.trim())))];
    if (locations.length && locations.length <= 5 && locations.every(town => (TOWNS as readonly string[]).includes(town))) {
      filters.locations = locations;
    }
  }
  if (typeof profile?.preferred_property_type === 'string') {
    try {
      filters.room_type = parseListingFilters({ room_type: profile.preferred_property_type.trim().toUpperCase() }).room_type;
    } catch (error) {
      if (!(error instanceof ListingQueryError)) throw error;
    }
  }
  return filters.locations?.length || filters.room_type ? parseListingFilters(filters) : undefined;
}

// Protect clear, literal town/budget/room-type requirements independently of model compliance.
// Other natural-language requirements still use the validated search tool schema.
export function explicitBuyerRequirements(history: ChatCompletionMessageParam[], previous?: ListingFilters, previousSearchIndex?: number): {
  filters: ExplicitFilters; retainedBudget: Pick<ListingFilters, 'min_price' | 'max_price'>; excludedTowns: string[]; unrestrictedLocation: boolean; unrestrictedBudget: boolean; unrestrictedRoomType: boolean; explicitFields: (keyof ExplicitFilters)[]; resetFilters: boolean;
} {
  let filters: ExplicitFilters = {
    ...(previous?.locations ? { locations: previous.locations } : {}),
    ...(previous?.min_price !== undefined ? { min_price: previous.min_price } : {}),
    ...(previous?.max_price !== undefined ? { max_price: previous.max_price } : {}),
    ...(previous?.room_type ? { room_type: previous.room_type } : {}),
  };
  let excludedTowns: string[] = [];
  let unrestrictedLocation = false;
  let unrestrictedBudget = false;
  let unrestrictedRoomType = false;
  let retainedBudget: Pick<ListingFilters, 'min_price' | 'max_price'> = {};
  const explicitFields = new Set<keyof ExplicitFilters>();
  let resetFilters = false;
  const users = history.filter(message => message.role === 'user');
  // A successful search already incorporated older turns, including preferences
  // extracted by the model. Replaying them would overwrite the saved snapshot.
  // New clients mark the last search response. Include subsequent advice turns,
  // so preferences shared while chatting survive until the next actual search.
  const pendingUsers = previous && previousSearchIndex !== undefined
    ? history.slice(previousSearchIndex + 1).filter(message => message.role === 'user')
    : previous ? users.slice(-1) : users;
  for (const { content } of pendingUsers) {
    // Earlier conversational preferences are defaults too. Only a concrete
    // constraint restated in the current message resists a contradictory clear.
    explicitFields.clear();
    const text = content.trim();
    if (/^(?:buy|i (?:want|would like) to buy(?: (?:a |an )?(?:property|hdb|home|house|flat))?)[.!?\s]*$/i.test(text)
      || /\b(?:start over|reset (?:my |the )?(?:search|preferences|requirements)|no preferences?(?=[,!.]|$)|no preferences? at all)/i.test(text)) {
      filters = {}; retainedBudget = {}; excludedTowns = [];
      explicitFields.clear(); resetFilters = true;
      unrestrictedLocation = !/^buy$|^i .* to buy/i.test(text);
      unrestrictedBudget = unrestrictedLocation;
      unrestrictedRoomType = unrestrictedLocation;
    }
    if (/\b(?:any(?:where| town| location| area)|all towns|no (?:town|location|area) preference|(?:remove|drop|clear) (?:the |my )?(?:town|location|area)(?: filter| requirement)?)\b|\b(?:just\s+)?any\s+executives?\b|^any(?: is fine)?[.!?\s]*$/i.test(text)) {
      delete filters.locations; excludedTowns = [];
      unrestrictedLocation = true;
    }
    if (/\b(?:no budget(?: limit)?|any budget|no price limit|(?:remove|drop|clear) (?:the |my )?(?:budget|price)(?: limit| filter)?)\b/i.test(text)) {
      delete filters.min_price; delete filters.max_price;
      unrestrictedBudget = true;
    }
    const included: string[] = [];
    const excluded: string[] = [];
    const removed: string[] = [];
    for (const match of text.matchAll(new RegExp(townPattern))) {
      const town = canonicalTown(match[0]);
      const before = text.slice(0, match.index).trimEnd();
      if (removalPrefix.test(before) || /\b(?:no (?:longer )?need|don['’]t need|do not need|(?:remove|drop|clear)(?: the)?|no need (?:to (?:be|search|look)|for))(?:\s+(?:in|homes? in|flats? in))?\s*$/i.test(before)) removed.push(town);
      else if (/\b(?:not|avoid|ignore|except|excluding|instead of|rather than|other than|no longer|no|don't want|do not want|not interested in)(?:\s+(?:in|homes? in|flats? in))?\s*$/i.test(before)) excluded.push(town);
      else included.push(town);
    }
    if (included.length) {
      filters.locations = [...new Set(included)].filter(town => !excluded.includes(town));
      // An explicit replacement removes exclusions from an older search.
      excludedTowns = excluded;
      unrestrictedLocation = false;
      explicitFields.add('locations');
    } else if (excluded.length) {
      excludedTowns = [...new Set([...excludedTowns, ...excluded])];
      filters.locations = filters.locations?.filter(town => !excludedTowns.includes(town));
    }
    if (removed.length && !included.length) {
      filters.locations = filters.locations?.filter(town => !removed.includes(town));
      excludedTowns = excludedTowns.filter(town => !removed.includes(town));
      if (!filters.locations?.length && !excludedTowns.length) {
        delete filters.locations;
        unrestrictedLocation = true;
      }
    }
    if (/\b(?:any room type|no (?:room|flat)[ -]?type preference|(?:remove|drop|clear) (?:the |my )?(?:room|flat)[ -]?type(?: filter)?)\b/i.test(text)) {
      delete filters.room_type;
      unrestrictedRoomType = true;
    }
    for (const room of text.matchAll(/\b(?:([2-5])[ -]?room|executives?)\b/gi)) {
      if (removalPrefix.test(text.slice(0, room.index).trimEnd())) {
        delete filters.room_type;
        unrestrictedRoomType = true;
        explicitFields.delete('room_type');
      } else if (!/\b(?:not|no|avoid|except|excluding|no need|don['’]t want|do not want)\s*$/i.test(text.slice(0, room.index).trimEnd())) {
        filters.room_type = room[1] ? `${room[1]} ROOM` as ListingFilters['room_type'] : 'EXECUTIVE';
        unrestrictedRoomType = false;
        explicitFields.add('room_type');
      }
    }
    const max = text.match(new RegExp(`\\b(?:under|below|up to|at most|less than|max(?:imum)?(?:\\s+(?:price|budget))?|budget(?:\\s+(?:is|of|to|up to))?)\\s*[:=]?\\s*${MONEY}`, 'i'));
    const min = text.match(new RegExp(`\\b(?:above|over|at least|more than|min(?:imum)?(?:\\s+(?:price|budget))?)\\s*[:=]?\\s*${MONEY}`, 'i'));
    const changingBudget = [...text.matchAll(new RegExp(MONEY, 'gi'))].some(match => isMoney(match, text))
      || (/\b(?:budget|price|spend|afford|limit|ceiling)\b/i.test(text)
        && /\b(?:increase|decrease|raise|lower|reduce|change|adjust|stretch)\b/i.test(text));
    if (changingBudget && !(max && isMoney(max, text)) && !(min && isMoney(min, text))) {
      // Nonliteral refinements ("make it 450k instead") need tool extraction.
      // Old bounds are defaults if omitted, not constraints overriding a new bound.
      retainedBudget = { min_price: filters.min_price, max_price: filters.max_price };
      delete filters.min_price; delete filters.max_price;
      explicitFields.delete('min_price'); explicitFields.delete('max_price');
      unrestrictedBudget = false;
    }
    if (max && isMoney(max, text)) { filters.max_price = amount(max); unrestrictedBudget = false; explicitFields.add('max_price'); }
    if (min && isMoney(min, text)) { filters.min_price = amount(min); unrestrictedBudget = false; explicitFields.add('min_price'); }
  }

  return { filters, retainedBudget, excludedTowns, unrestrictedLocation, unrestrictedBudget, unrestrictedRoomType, explicitFields: [...explicitFields], resetFilters };
}

export function applyExplicitRequirements(proposed: ListingFilters, required: ReturnType<typeof explicitBuyerRequirements>): ListingFilters {
  const filters = { ...required.retainedBudget, ...proposed, ...required.filters };
  if (required.unrestrictedLocation) delete filters.locations;
  if (required.unrestrictedBudget) { delete filters.min_price; delete filters.max_price; }
  if (required.unrestrictedRoomType) delete filters.room_type;
  if (required.excludedTowns.length && (!filters.locations?.length || filters.locations.some(town => required.excludedTowns.includes(town)))) {
    // The query contract supports positive town alternatives, not exclusion-only searches.
    throw new ListingQueryError('Ask for a preferred town instead of searching an excluded town.');
  }
  return parseListingFilters(filters);
}

// Tool arguments are an update: omitted fields retain the saved search, whereas
// null (or an empty array) explicitly clears a constraint. Preserve that intent
// before normalization, which otherwise turns both cases into an absent field.
export function resolveListingToolFilters(value: unknown, required: ReturnType<typeof explicitBuyerRequirements>, previous?: ListingFilters): ListingFilters {
  const proposed = parseListingFilters(value);
  const input = value as Record<string, unknown>;
  const filters: ListingFilters = { ...(required.resetFilters ? {} : previous), ...proposed };
  if (input.sort_by === undefined && previous && !required.resetFilters) filters.sort_by = previous.sort_by;
  const constraints = { ...required.filters };
  const retainedBudget = { ...required.retainedBudget };
  for (const field of Object.keys(input) as (keyof ListingFilters)[]) {
    if (field === 'sort_by' || !(input[field] === null || Array.isArray(input[field]) && input[field].length === 0)) continue;
    delete filters[field];
    if (field in constraints && !required.explicitFields.includes(field as keyof ExplicitFilters)) {
      delete constraints[field as keyof ExplicitFilters];
    }
    if (field === 'min_price' || field === 'max_price') delete retainedBudget[field];
  }
  return applyExplicitRequirements(filters, { ...required, filters: constraints, retainedBudget });
}
