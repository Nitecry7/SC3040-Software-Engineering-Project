// Provider tool syntax is internal, even when a provider incorrectly emits it as text.
export function containsToolMarkup(content: string): boolean {
  return /<\/?(?:tool_call\b|function[=\s>]|parameter[=\s>])/i.test(content);
}

export function visibleAssistantText(content: string): string {
  let visible = content
    .replace(/<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call\s*>|$)/gi, '')
    .replace(/<function[=\s][^>]*>[\s\S]*?(?:<\/function\s*>|$)/gi, '')
    .replace(/<parameter[=\s][^>]*>[\s\S]*?(?:<\/parameter\s*>|$)/gi, '')
    .replace(/<\/(?:tool_call|function|parameter)\s*>/gi, '');
  // Hold a potential opening tag until streaming reveals whether it is tool syntax.
  const tail = visible.match(/<[^>]*$/)?.[0];
  if (tail && ['tool_call', '/tool_call', 'function', '/function', 'parameter', '/parameter']
    .some(tag => tag.startsWith(tail.slice(1).toLowerCase()) || tail.slice(1).toLowerCase().startsWith(tag))) {
    visible = visible.slice(0, -tail.length);
  }
  return visible;
}
