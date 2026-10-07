import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import type { MouseEventHandler } from 'react';
import { visibleAssistantText } from '../../../BackEnd/supabase/functions/_shared/chatOutput.ts';

export default function ChatMarkdown({ content, onListingOpen }: { content: string; onListingOpen?: MouseEventHandler<HTMLAnchorElement> }) {
  return <div className="chat-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      a: ({ href, children }) => href?.startsWith('/') && !href.startsWith('//')
        ? <Link to={href} onClick={href.startsWith('/property/') ? onListingOpen : undefined}>{children}</Link>
        : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      table: ({ children }) => <div className="chat-table-scroll"><table>{children}</table></div>,
      // Listing photos belong to expanded recommendation cards; generated image markup stays a link.
      img: ({ src, alt }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || 'View image'}</a>,
    }}>{visibleAssistantText(content)}</ReactMarkdown>
  </div>;
}
