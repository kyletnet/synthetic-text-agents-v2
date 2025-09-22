// Minimal chunker: paragraph-first; falls back to sliding window.
// Keeps things deterministic & dependency-free.

export interface Chunk {
  id: string;
  text: string;
  start: number;
  end: number;
  meta?: Record<string, unknown>;
}

export interface ChunkOptions {
  maxChars?: number;   // preferred max chunk length
  overlap?: number;    // overlap size for sliding window fallback
  minChars?: number;   // try not to emit ultra-small chunks
}

const DEFAULTS: Required<ChunkOptions> = {
  maxChars: 1200,
  overlap: 120,
  minChars: 200,
};

export function chunkText(input: string, options: ChunkOptions = {}): Chunk[] {
  const cfg = { ...DEFAULTS, ...options };
  const text = input ?? '';
  if (!text.trim()) return [];

  const paras = text.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];

  // First pass: group paragraphs until near maxChars
  let buf = '';
  let cursor = 0;
  for (const p of paras) {
    if ((buf + (buf ? '\n\n' : '') + p).length <= cfg.maxChars) {
      buf = buf ? `${buf}\n\n${p}` : p;
      continue;
    }
    if (buf.length) {
      chunks.push(toChunk(chunks.length, text, cursor, cursor + buf.length));
      cursor += buf.length + 2; // skip assumed "\n\n"
      buf = p;
    } else {
      // single paragraph is too large → slide window
      const oversized = p;
      const windows = sliding(oversized, cfg.maxChars, cfg.overlap);
      for (const w of windows) {
        chunks.push(toChunk(chunks.length, text, cursor, cursor + w.length));
        cursor += w.length - cfg.overlap;
      }
      buf = '';
    }
  }
  if (buf.length) {
    chunks.push(toChunk(chunks.length, text, cursor, cursor + buf.length));
  }

  // Second pass: if no paragraphs or all tiny → sliding on whole text
  if (chunks.length === 0 || chunks.every(c => c.text.length < cfg.minChars)) {
    const windows = sliding(text, cfg.maxChars, cfg.overlap);
    const pos = 0;
    return windows.map((w, i) => ({
      id: `c${i}`,
      text: w,
      start: pos + i * (cfg.maxChars - cfg.overlap),
      end:   pos + i * (cfg.maxChars - cfg.overlap) + w.length,
      meta: { strategy: 'sliding' },
    }));
  }

  return chunks;
}

function toChunk(idx: number, full: string, start: number, end: number): Chunk {
  const safeStart = Math.max(0, start);
  const safeEnd   = Math.min(full.length, end);
  return {
    id: `c${idx}`,
    text: full.slice(safeStart, safeEnd),
    start: safeStart,
    end: safeEnd,
    meta: { strategy: 'paragraph-pack' },
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
