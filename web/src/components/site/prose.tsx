import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A number, with the unit that makes it mean something.
 *
 * Longer alternatives come first, so `ms` is not matched as a bare `m` followed by stray
 * text, and `kHz` is not matched as `Hz`. The single capture group is what makes `split`
 * return text and matches alternating, so the caller can tell them apart by index parity
 * rather than by re-testing with a stateful global regex.
 */
const NUMBER =
  /(\d[\d,]*(?:\.\d+)?(?:\s?(?:%|×|mm|cm|km|ms|kHz|MHz|Hz|MB|GB|kB|kg|ml|mph|fps|rpm|[gGxsm]\b))?)/g;

/**
 * Wraps numbers in a run of children so they can be read without reading the sentence.
 *
 * Recursive because markdown gives us nested nodes — a number inside a `**bold**` run is
 * still a number. Only string leaves are touched, and only by wrapping: no character is
 * added, removed or reordered, which is what the test asserts.
 */
function emphasiseNumbers(node: ReactNode, keyPrefix = "n"): ReactNode {
  if (typeof node === "string") {
    const parts = node.split(NUMBER);
    if (parts.length === 1) return node;
    return parts.map((part, i) =>
      // Odd indices are the capture group; even indices are the text between matches.
      i % 2 === 1 ? (
        <span key={`${keyPrefix}-${i}`} className="tabular font-mono font-semibold text-primary">
          {part}
        </span>
      ) : (
        part
      ),
    );
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => emphasiseNumbers(child, `${keyPrefix}-${i}`));
  }
  return node;
}

/**
 * Renders a vault entry body. Vault markdown is plain — headings, paragraphs, lists,
 * links, inline code — so the component map stays small and every element is styled
 * explicitly rather than relying on a typography plugin.
 *
 * `numbers` is opt-in and off everywhere except the measured-results section of a case study
 * (see `case-study.tsx`). It must stay opt-in: this same component renders experience entries,
 * lab write-ups, the private calendar's rules and every vault document, and magenta-highlighting
 * every figure in those would be noise where it is signal on a results panel.
 */
export function Prose({ children, numbers = false }: { children: string; numbers?: boolean }) {
  const t = numbers ? emphasiseNumbers : (node: ReactNode) => node;

  return (
    <div className="max-w-[68ch] space-y-4 text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: () => null, // the page supplies its own title
          h2: ({ children }) => (
            <h2 className="pt-4 text-base font-semibold text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="pt-2 text-sm font-semibold text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p>{t(children)}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-primary/60">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 marker:text-primary/60">{children}</ol>
          ),
          // Results are as likely to be a bulleted list of numbers as a sentence, so the
          // transform has to reach list items too, not just paragraphs.
          li: ({ children }) => <li>{t(children)}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded border border-border bg-accent px-1 py-0.5 font-mono text-[0.85em] text-primary">
              {children}
            </code>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{t(children)}</strong>
          ),
          // Wide content scrolls inside its own box; the page body must never scroll sideways.
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border border-border bg-card/70 p-3 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 font-medium text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-3 py-2">{t(children)}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
