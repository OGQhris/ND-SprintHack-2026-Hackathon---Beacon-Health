"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const remarkPlugins = [remarkGfm];

/** Only the elements that need attributes or wrappers; spacing comes from the scoped classes below. */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-seal underline underline-offset-4 hover:text-seal-strong">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-rule">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-folder-inset text-xs text-ink-soft">{children}</thead>,
  th: ({ children }) => <th className="border-b border-rule px-2.5 py-1.5 font-medium whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="border-b border-rule px-2.5 py-1.5 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-folder-inset p-3 font-mono text-xs leading-relaxed">{children}</pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-folder-inset px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
    ),
};

const TYPOGRAPHY = [
  "text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold",
  "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[15px] [&_h2]:font-semibold",
  "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft",
  "[&_hr]:my-3 [&_hr]:border-rule",
  "[&_tr:last-child>td]:border-b-0",
].join(" ");

/** Assistant replies are Markdown (the system prompt asks for short paragraphs and small tables). */
export function AssistantMarkdown({ text, compact, className }: { text: string; compact?: boolean; className?: string }) {
  return (
    <div className={cn(TYPOGRAPHY, compact ? "text-sm leading-relaxed" : "text-[15px] leading-relaxed", className)}>
      <Markdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
