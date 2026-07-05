/**
 * Shared text-chunking helper.
 *
 * Splits text into overlapping chunks on a configurable boundary pattern
 * (paragraph breaks by default, or e.g. markdown "## " headers). Used by
 * phb-import.ts, srd-import.ts, monster-import.ts and document.service.ts —
 * previously each had its own byte-identical or near-identical copy.
 */

export interface ChunkTextOptions {
  /** Max chunk length in characters before splitting. Default 1500. */
  chunkSize?: number;
  /** Approximate overlap (in characters) carried into the next chunk. Default 200. */
  overlap?: number;
  /** Pattern used to split the input into segments. Default paragraph breaks (`/\n\n+/`). */
  splitPattern?: RegExp;
  /** Separator used to join segments when appending within the size limit. Default "\n\n". */
  joiner?: string;
  /** Separator used between the carried-over overlap words and the next segment. Default " ". */
  overlapJoiner?: string;
}

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP = 200;
const DEFAULT_SPLIT_PATTERN = /\n\n+/;
const DEFAULT_JOINER = "\n\n";
const DEFAULT_OVERLAP_JOINER = " ";

export function chunkText(text: string, options: ChunkTextOptions = {}): string[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    splitPattern = DEFAULT_SPLIT_PATTERN,
    joiner = DEFAULT_JOINER,
    overlapJoiner = DEFAULT_OVERLAP_JOINER,
  } = options;

  const chunks: string[] = [];
  const segments = text.split(splitPattern);
  let current = "";

  for (const segment of segments) {
    if ((current + segment).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.ceil(overlap / 6));
      current = overlapWords.join(" ") + overlapJoiner + segment;
    } else {
      current = current ? current + joiner + segment : segment;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}
