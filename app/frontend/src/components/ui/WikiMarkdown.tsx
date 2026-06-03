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
  return text.replace(/\[\[(.+?)\]\]/g, (_, name: string) =>
    `[${name}](wiki://${encodeURIComponent(name)})`
  );
}

/**
 * Validador de URLs para ReactMarkdown.
 * Permite solo protocolos seguros y rutas relativas.
 * Bloquea javascript:, vbscript:, data: y cualquier otro esquema no autorizado.
 */
function safeUrlTransform(url: string): string {
  // Permite enlaces wiki internos (gestionados por el componente `a`)
  if (url.startsWith("wiki://")) return url;
  // Permite protocolos web estándar
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  // Permite rutas relativas y anclas
  if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) return url;
  // Bloquea todo lo demás (javascript:, vbscript:, data:, etc.)
  return "";
}

export function WikiMarkdown({ children, campaignId }: WikiMarkdownProps) {
  if (!children) return null;
  const processed = preprocessWikiLinks(children);

  const components: Components = {
    a: ({ href, children: linkChildren }) => {
      if (href?.startsWith("wiki://")) {
        const name = decodeURIComponent(href.slice(7));
        if (campaignId) {
          return <WikiLink name={name} campaignId={campaignId} />;
        }
        // campaignId no disponible — renderizar como texto plano
        return <span className="text-amber-400 decoration-dotted underline">{name}</span>;
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (href && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
              e.preventDefault();
              import("@tauri-apps/plugin-shell").then(({ open }) => open(href));
            }
          }}
        >
          {linkChildren}
        </a>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={safeUrlTransform}>
      {processed}
    </ReactMarkdown>
  );
}
