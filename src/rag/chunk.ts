// Enhanced chunker: semantic-aware chunking with markdown support.
// Prioritizes logical document structure while maintaining backward compatibility.

export interface Chunk {
  id: string;
  text: string;
  content: string; // Alias for backward compatibility
  start: number;
  end: number;
  meta?: Record<string, unknown>;
}

export interface ChunkOptions {
  maxChars?: number; // preferred max chunk length
  overlap?: number; // overlap size for sliding window fallback
  minChars?: number; // try not to emit ultra-small chunks
  strategy?: "smart" | "paragraph" | "sliding"; // chunking strategy
  respectMarkdown?: boolean; // respect markdown structure
}

const DEFAULTS: Required<ChunkOptions> = {
  maxChars: 1200,
  overlap: 120,
  minChars: 200,
  strategy: "smart",
  respectMarkdown: true,
};

export function chunkText(input: string, options: ChunkOptions = {}): Chunk[] {
  const cfg = { ...DEFAULTS, ...options };
  const text = input ?? "";
  if (!text.trim()) return [];

  // Choose chunking strategy
  switch (cfg.strategy) {
    case "smart":
      return smartChunk(text, cfg);
    case "paragraph":
      return paragraphChunk(text, cfg);
    case "sliding":
      return slidingChunk(text, cfg);
    default:
      return smartChunk(text, cfg);
  }
}

function smartChunk(text: string, cfg: Required<ChunkOptions>): Chunk[] {
  // First try markdown-aware chunking if enabled
  if (cfg.respectMarkdown && hasMarkdownStructure(text)) {
    const mdChunks = markdownChunk(text, cfg);
    if (mdChunks.length > 0) {
      return mdChunks;
    }
  }

  // Fallback to enhanced paragraph chunking
  return paragraphChunk(text, cfg);
}

function markdownChunk(text: string, cfg: Required<ChunkOptions>): Chunk[] {
  const chunks: Chunk[] = [];
  const sections = splitByMarkdownHeaders(text);

  let cursor = 0;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionStart = text.indexOf(section.content, cursor);

    if (section.content.length <= cfg.maxChars) {
      // Section fits in one chunk
      chunks.push({
        id: `md${i}`,
        text: section.content,
        content: section.content,
        start: sectionStart,
        end: sectionStart + section.content.length,
        meta: {
          strategy: "markdown",
          header: section.header,
          level: section.level,
        },
      });
    } else {
      // Section too large, split with paragraph chunking but preserve header context
      const subChunks = paragraphChunk(section.content, cfg);
      subChunks.forEach((subChunk, j) => {
        chunks.push({
          ...subChunk,
          id: `md${i}_${j}`,
          start: sectionStart + subChunk.start,
          end: sectionStart + subChunk.end,
          meta: {
            ...subChunk.meta,
            parentHeader: section.header,
            parentLevel: section.level,
          },
        });
      });
    }

    cursor = sectionStart + section.content.length;
  }

  return chunks;
}

function paragraphChunk(text: string, cfg: Required<ChunkOptions>): Chunk[] {
  const paras = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];

  // First pass: group paragraphs until near maxChars
  let buf = "";
  let cursor = 0;
  for (const p of paras) {
    if ((buf + (buf ? "\n\n" : "") + p).length <= cfg.maxChars) {
      buf = buf ? `${buf}\n\n${p}` : p;
      continue;
    }
    if (buf.length) {
      chunks.push(
        toChunk(
          chunks.length,
          text,
          cursor,
          cursor + buf.length,
          "paragraph-pack",
        ),
      );
      cursor += buf.length + 2; // skip assumed "\n\n"
      buf = p;
    } else {
      // single paragraph is too large → slide window
      const oversized = p;
      const windows = sliding(oversized, cfg.maxChars, cfg.overlap);
      for (const w of windows) {
        chunks.push(
          toChunk(chunks.length, text, cursor, cursor + w.length, "sliding"),
        );
        cursor += w.length - cfg.overlap;
      }
      buf = "";
    }
  }
  if (buf.length) {
    chunks.push(
      toChunk(
        chunks.length,
        text,
        cursor,
        cursor + buf.length,
        "paragraph-pack",
      ),
    );
  }

  // Second pass: if no paragraphs or all tiny → sliding on whole text
  if (
    chunks.length === 0 ||
    chunks.every((c) => c.text.length < cfg.minChars)
  ) {
    return slidingChunk(text, cfg);
  }

  return chunks;
}

function slidingChunk(text: string, cfg: Required<ChunkOptions>): Chunk[] {
  const windows = sliding(text, cfg.maxChars, cfg.overlap);
  return windows.map((w, i) => ({
    id: `s${i}`,
    text: w,
    content: w,
    start: i * (cfg.maxChars - cfg.overlap),
    end: i * (cfg.maxChars - cfg.overlap) + w.length,
    meta: { strategy: "sliding" },
  }));
}

interface MarkdownSection {
  header: string;
  level: number;
  content: string;
}

function splitByMarkdownHeaders(text: string): MarkdownSection[] {
  const lines = text.split("\n");
  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        if (currentSection.content) {
          sections.push(currentSection);
        }
      }

      // Start new section
      currentSection = {
        header: headerMatch[2],
        level: headerMatch[1].length,
        content: "",
      };
      contentLines = [line]; // Include header in content
    } else {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }

  // If no sections found, treat whole text as one section
  if (sections.length === 0) {
    sections.push({
      header: "Document",
      level: 1,
      content: text,
    });
  }

  return sections;
}

function hasMarkdownStructure(text: string): boolean {
  // Check for markdown headers
  return /^#{1,6}\s+.+$/m.test(text);
}

function toChunk(
  idx: number,
  full: string,
  start: number,
  end: number,
  strategy: string = "paragraph-pack",
): Chunk {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(full.length, end);
  const content = full.slice(safeStart, safeEnd);
  return {
    id: `c${idx}`,
    text: content,
    content: content, // Backward compatibility
    start: safeStart,
    end: safeEnd,
    meta: { strategy },
  };
}

function sliding(s: string, size: number, overlap: number): string[] {
  if (!s) return [];
  const step = Math.max(1, size - overlap);
  const out: string[] = [];
  for (let i = 0; i < s.length; i += step) {
    out.push(s.slice(i, i + size));
    if (i + size >= s.length) break;
  }
  return out;
}
