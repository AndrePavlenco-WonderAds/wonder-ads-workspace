"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="seo-markdown text-sm leading-relaxed text-white/85">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              {...props}
              className="mt-6 mb-3 text-xl font-semibold tracking-tight text-white first:mt-0"
            />
          ),
          h2: (props) => (
            <h2
              {...props}
              className="mt-5 mb-2 text-lg font-semibold tracking-tight text-white first:mt-0"
            />
          ),
          h3: (props) => (
            <h3
              {...props}
              className="mt-4 mb-2 text-[15px] font-semibold tracking-tight text-white first:mt-0"
            />
          ),
          h4: (props) => (
            <h4
              {...props}
              className="mt-3 mb-2 text-sm font-semibold tracking-tight text-white/90 first:mt-0"
            />
          ),
          p: (props) => <p {...props} className="my-2.5" />,
          ul: (props) => (
            <ul {...props} className="my-2.5 list-disc space-y-1 pl-5" />
          ),
          ol: (props) => (
            <ol {...props} className="my-2.5 list-decimal space-y-1 pl-5" />
          ),
          li: (props) => <li {...props} className="leading-relaxed" />,
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--brand-purple)] underline-offset-2 hover:underline"
            />
          ),
          strong: (props) => (
            <strong {...props} className="font-semibold text-white" />
          ),
          em: (props) => <em {...props} className="italic" />,
          blockquote: (props) => (
            <blockquote
              {...props}
              className="my-3 border-l-2 border-[color:var(--brand-purple)]/45 pl-3 text-white/70"
            />
          ),
          hr: () => <hr className="my-5 border-white/10" />,
          code: ({ className, children, ...rest }) => {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code
                  className={`${className} font-mono text-[12.5px] leading-relaxed text-white/85`}
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[12px] text-white/85"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              {...props}
              className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[12.5px] leading-relaxed"
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table
                {...props}
                className="w-full border-collapse text-left text-[13px]"
              />
            </div>
          ),
          thead: (props) => (
            <thead {...props} className="border-b border-white/15" />
          ),
          th: (props) => (
            <th
              {...props}
              className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65"
            />
          ),
          td: (props) => (
            <td
              {...props}
              className="border-b border-white/5 px-2 py-1.5 align-top text-white/80"
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
