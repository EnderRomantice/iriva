'use client';
import { memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type HastNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

/** Wrap case-insensitive matches of `query` in <mark>, inside any formatting. */
function rehypeHighlight(query: string) {
  const needle = query.toLocaleLowerCase();
  const visit = (node: HastNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap(child => {
      if (child.type !== 'text' || !child.value) { visit(child); return [child]; }
      const out: HastNode[] = [], text = child.value, lower = text.toLocaleLowerCase();
      let from = 0, at = lower.indexOf(needle);
      if (at < 0) return [child];
      while (at >= 0) {
        if (at > from) out.push({ type: 'text', value: text.slice(from, at) });
        out.push({ type: 'element', tagName: 'mark', properties: {}, children: [{ type: 'text', value: text.slice(at, at + needle.length) }] });
        from = at + needle.length; at = lower.indexOf(needle, from);
      }
      if (from < text.length) out.push({ type: 'text', value: text.slice(from) });
      return out;
    });
  };
  return () => (tree: HastNode) => { if (needle) visit(tree); };
}

// Chat-sized subset: no raw HTML, images or form controls. Headings render as bold lines.
const allowed = ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'hr', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const heading = ({ children }: { children?: ReactNode }) => <p className="md-heading"><strong>{children}</strong></p>;
const components: Components = {
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{children}</a>,
  h1: heading, h2: heading, h3: heading, h4: heading, h5: heading, h6: heading,
  table: ({ children }) => <div className="md-table"><table>{children}</table></div>,
};
const safeUrl = (url: string) => /^(https?:|mailto:)/i.test(url) ? url : '';

/** Renders a chat message as GitHub-flavoured Markdown. Single newlines are kept as line breaks. */
function MessageMarkdown({ text, highlight = '' }: { text: string; highlight?: string }) {
  return <div className="md">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={highlight ? [rehypeHighlight(highlight)] : []}
      allowedElements={allowed} unwrapDisallowed skipHtml urlTransform={safeUrl} components={components}>{text}</ReactMarkdown>
  </div>;
}
export default memo(MessageMarkdown);
