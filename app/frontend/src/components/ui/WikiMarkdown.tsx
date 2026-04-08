"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { WikiLink } from "./WikiLink";

interface WikiMarkdownProps {
  children: string;
  campaignId?: string;
}

function preprocessWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, name: string) =>
    `[${name}](wiki://${encodeURIComponent(name)})`
  );
}

export function WikiMarkdown({ children, campaignId }: WikiMarkdownProps) {
  const processed = preprocessWikiLinks(children);

  const components: Components = {
    a: ({ href, children: linkChildren }) => {
      if (href?.startsWith("wiki://") && campaignId) {
        const name = decodeURIComponent(href.slice(7));
        return <WikiLink name={name} campaignId={campaignId} />;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {linkChildren}
        </a>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {processed}
    </ReactMarkdown>
  );
}
