import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a vault entry body. Vault markdown is plain — headings, paragraphs, lists,
 * links, inline code — so the component map stays small and every element is styled
 * explicitly rather than relying on a typography plugin.
 */
export function Prose({ children }: { children: string }) {
  return (
    <div className="max-w-[68ch] space-y-4 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
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
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-primary/60">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 marker:text-primary/60">{children}</ol>
          ),
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
            <strong className="font-semibold text-foreground">{children}</strong>
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
          td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
