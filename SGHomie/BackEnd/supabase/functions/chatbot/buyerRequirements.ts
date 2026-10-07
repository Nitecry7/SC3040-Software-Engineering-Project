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

// Protect clear, literal town/budget/room-type requirements independently of model compliance.
// Other natural-language requirements still use the validated search tool schema.
export function explicitBuyerRequirements(history: ChatCompletionMessageParam[], previous?: ListingFilters): {
  filters: ExplicitFilters; retainedBudget: Pick<ListingFilters, 'min_price' | 'max_price'>; excludedTowns: string[]; unrestrictedLocation: boolean; unrestrictedBudget: boolean; unrestrictedRoomType: boolean; searchRequested: boolean;
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
  const users = history.filter(message => message.role === 'user');
  // A successful search already incorporated older turns, including preferences
  // extracted by the model. Replaying them would overwrite the saved snapshot.
  const pendingUsers = previous ? users.slice(-1) : users;
  for (const { content } of pendingUsers) {
    const text = content.trim();
    if (/^(?:buy|i (?:want|would like) to buy(?: (?:a |an )?(?:property|hdb|home|house|flat))?)[.!?\s]*$/i.test(text)
      || /\b(?:start over|reset (?:my |the )?(?:search|preferences|requirements)|no preferences?(?=[,!.]|$)|no preferences? at all)/i.test(text)) {
      filters = {}; retainedBudget = {}; excludedTowns = [];
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
      if (/\b(?:no (?:longer )?need|don['’]t need|do not need|(?:remove|drop|clear)(?: the)?|no need (?:to (?:be|search|look)|for))(?:\s+(?:in|homes? in|flats? in))?\s*$/i.test(before)) removed.push(town);
      else if (/\b(?:not|avoid|ignore|except|excluding|instead of|rather than|other than|no longer|no|don't want|do not want|not interested in)(?:\s+(?:in|homes? in|flats? in))?\s*$/i.test(before)) excluded.push(town);
      else included.push(town);
    }
    if (included.length) {
      filters.locations = [...new Set(included)].filter(town => !excluded.includes(town));
      // An explicit replacement removes exclusions from an older search.
      excludedTowns = excluded;
      unrestrictedLocation = false;
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
    const room = text.match(/\b(?:([2-5])[ -]?room|executives?)\b/i);
    if (room && !/\b(?:not|no|avoid|except|excluding|no need|don['’]t want|do not want)\s*$/i.test(text.slice(0, room.index).trimEnd())) {
      filters.room_type = room[1] ? `${room[1]} ROOM` as ListingFilters['room_type'] : 'EXECUTIVE';
      unrestrictedRoomType = false;
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
      unrestrictedBudget = false;
    }
    if (max && isMoney(max, text)) { filters.max_price = amount(max); unrestrictedBudget = false; }
    if (min && isMoney(min, text)) { filters.min_price = amount(min); unrestrictedBudget = false; }
  }
  const latest = users.at(-1)?.content ?? '';
  townPattern.lastIndex = 0;
  const searchRequested = !/\b(?:condo(?:minium)?|landed)\b|^(?:what|where) is\b/i.test(latest) && (
    townPattern.test(latest)
    || /^any(?: is fine)?[.!?\s]*$/i.test(latest.trim())
    || /\b(?:under|below|budget|at most|up to)\s*[:=]?\s*(?:S\$|SGD\s*|\$)?\s*\d/i.test(latest)
    || /\b[2-5][ -]?room\b|\bexecutives?\b|\b\d+\s+bedrooms?\b|\bno preferences?\b|\bany\s+(?:homes?|hdbs?|flats?|listings?|town|location|area|room type)\b|\banywhere\b/i.test(latest)
  );
  return { filters, retainedBudget, excludedTowns, unrestrictedLocation, unrestrictedBudget, unrestrictedRoomType, searchRequested };
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

// These complete commands change only preferences already covered by the literal guard.
// Do not use partial keyword matching here: "any town with a balcony" needs extraction.
export function simpleBuyerRefinement(
  content: string, previous: ListingFilters | undefined, required: ReturnType<typeof explicitBuyerRequirements>,
): ListingFilters | undefined {
  if (!previous || !required.searchRequested || !required.unrestrictedLocation || required.excludedTowns.length) return;
  const text = content.trim().replace(/\s+/g, ' ');
  const townNames = TOWNS.map(town => town.replaceAll(' ', '\\s+')).join('|');
  const removal = new RegExp(`^(?:no (?:longer )?need|don['’]t need|do not need|remove|drop|clear)\\s+(?:${townNames}|AMK)(?=[\\s,.!?]|$)[\\s,.!?]*`, 'i');
  const remainder = text.replace(removal, '').trim();
  const completeCommand = /^(?:(?:just\s+)?(?:any(?: town| location| area)?|anywhere|(?:any\s+)?executives?)(?:\s+(?:is fine|please))?)[.!?]*$/i.test(remainder);
  if (!completeCommand && !(remainder === '' && removal.test(text))) return;
  // Keep every saved filter (beds, baths, area, keywords, sort), not just town/budget.
  return applyExplicitRequirements(previous, required);
}

function completeLiteralSearch(text: string): boolean {
  let remainder = text.trim();
  let recognized = false;
  remainder = remainder.replace(new RegExp(townPattern), () => { recognized = true; return ' '; });
  const rooms = [...remainder.matchAll(/\b(?:[2-5][ -]?room|executives?)\b/gi)];
  if (rooms.length > 1) return false; // Multiple room types need clarification/extraction.
  remainder = remainder.replace(/\b(?:[2-5][ -]?room|executives?)\b/gi, () => { recognized = true; return ' '; });
  for (const prefix of [
    'under|below|up to|at most|less than|max(?:imum)?(?:\\s+(?:price|budget))?|budget(?:\\s+(?:is|of|to|up to))?',
    'above|over|at least|more than|min(?:imum)?(?:\\s+(?:price|budget))?',
  ]) {
    const matches = [...remainder.matchAll(new RegExp(`\\b(?:${prefix})\\s*[:=]?\\s*${MONEY}`, 'gi'))];
    if (matches.length > 1) return false;
    for (const match of matches) {
      if (!isMoney(match, remainder)) return false;
      recognized = true;
      remainder = remainder.replace(match[0], ' ');
    }
  }
  remainder = remainder.replace(/\b(?:any(?:where| town| location| area)|all towns|no (?:town|location|area) preference|any room type|no (?:room|flat)[ -]?type preference|no budget(?: limit)?|any budget|no price limit|no preferences?(?: at all)?|start over)\b|^any(?: is fine)?[.!?\s]*$/gi,
    () => { recognized = true; return ' '; });
  // Allow only conversational glue after consuming all supported requirements.
  // Unknown words/numbers (balcony, MRT, bedrooms, sqft, negation, sorting...) must
  // stay with model extraction, never silently become a partial database query.
  remainder = remainder.replace(/\b(?:i|want|would|like|to|buy|find|search|show|me|please|hdbs?|homes?|houses?|flats?|listings?|a|an|the|only|just|in|at|and|or|with|for|any|is|fine)\b/gi, ' ');
  return recognized && /^[\s,.!?]*$/.test(remainder);
}

export function literalBuyerSearch(
  history: ChatCompletionMessageParam[], previous: ListingFilters | undefined, required: ReturnType<typeof explicitBuyerRequirements>,
): ListingFilters | undefined {
  if (!required.searchRequested || required.excludedTowns.length) return;
  const users = history.filter(message => message.role === 'user');
  const latest = users.at(-1)?.content ?? '';
  if (!completeLiteralSearch(latest)) return;
  if (!previous) {
    // Without saved query context, ensure every requirement since starting Buy is
    // understood. A later town must not erase an earlier unsupported must-have.
    const start = users.map(message => /^(?:buy|i (?:want|would like) to buy(?: (?:a |an )?(?:property|hdb|home|house|flat))?)[.!?\s]*$/i.test(message.content.trim())).lastIndexOf(true);
    if (users.slice(start + 1).some(message => !completeLiteralSearch(message.content))) return;
  }
  const reset = /\b(?:start over|no preferences?(?=[,!.]|$)|no preferences? at all)/i.test(latest);
  try {
    return applyExplicitRequirements(reset ? parseListingFilters({}) : previous ?? parseListingFilters({}), required);
  } catch (error) {
    if (!(error instanceof ListingQueryError)) throw error;
    return; // Contradictory literal requirements still need clarification.
  }
}
