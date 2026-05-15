"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AiChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ ...props }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: ({ ...props }) => (
          <th
            className="border border-border bg-muted px-3 py-1.5 text-left text-xs font-medium"
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td className="border border-border px-3 py-1.5 text-sm" {...props} />
        ),
        code: ({ ...props }) => (
          <code
            className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
            {...props}
          />
        ),
        ul: ({ ...props }) => (
          <ul className="my-2 list-inside list-disc space-y-1" {...props} />
        ),
        ol: ({ ...props }) => (
          <ol className="my-2 list-inside list-decimal space-y-1" {...props} />
        ),
        strong: ({ ...props }) => (
          <strong className="font-semibold" {...props} />
        ),
        p: ({ ...props }) => (
          <p className="mb-2 leading-relaxed last:mb-0" {...props} />
        ),
      }}>
      {content}
    </ReactMarkdown>
  );
}
