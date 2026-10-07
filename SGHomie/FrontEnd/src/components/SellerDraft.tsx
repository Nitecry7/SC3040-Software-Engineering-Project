import { Link } from 'react-router-dom';
import type { MouseEventHandler } from 'react';
import type { SellerDraftCard } from '../lib/chat';

export default function SellerDraft({ draft, onListingOpen }: { draft: SellerDraftCard; onListingOpen: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link to={`/seller?draft=${encodeURIComponent(draft.id)}`} onClick={onListingOpen}
      aria-label={`Continue draft: ${draft.title}`}
      className="mt-3 block rounded-lg border border-blue-200 bg-white p-3 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <p className="mb-1 text-xs font-medium text-green-700">Saved draft</p>
      <p className="text-sm font-semibold text-gray-900">{draft.title}</p>
      <p className="mt-1 text-xs text-gray-600">{draft.location} · HDB</p>
      <p className="mt-1 text-sm font-semibold text-blue-700">{draft.price ? `S$${draft.price.toLocaleString('en-SG')}` : 'Price to be added'}</p>
      <p className="mt-2 text-xs text-gray-500">To complete: {draft.missing_fields.join(', ')}.</p>
      <p className="mt-2 text-sm font-medium text-blue-600">Continue listing →</p>
    </Link>
  );
}
