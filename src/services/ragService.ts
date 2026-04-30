/**
 * ragService — query-time retrieval of culinary chunks from the web's
 * indexed knowledge base. Best-effort: failures are silent so inference
 * proceeds without context rather than blocking the user.
 *
 * Privacy boundary (per wiki/concepts/privacy-invariant.md, updated
 * 2026-04-30): the user's query text leaves the device. The model's
 * response, multi-turn history, and image attachments do not.
 *
 * Web contract (verified 2026-04-30, deployed at commit 8a72295):
 *   POST /api/mobile/rag/retrieve
 *   Auth: required (Bearer)
 *   Rate limit: 60 req/min/user
 *   200: { chunks: RagChunk[], vectorSearchEnabled: boolean }
 *   400: zod validation { error, details }
 *   401/429/503: standard envelope
 *   Empty results return 200 with chunks: [] — never 404.
 *
 * Privacy doctrine on the server side: query text is NEVER persisted.
 * Server logs userId, latency, chunkCount, search mode (vector|keyword),
 * limit, and category — not the query itself. The mobile-side privacy
 * invariant (queries leave the device for retrieval; responses + history
 * stay on device) is preserved end-to-end.
 */
import { apiClient } from '@/services/apiClient';

import { ApiError, NetworkError } from './__errors__';

/** Hard cap on RAG round-trip. We'd rather answer without context than block. */
const RAG_TIMEOUT_MS = 3000;

/** Default top-k. The server's max is 20; we cap lower to keep prompts compact. */
const DEFAULT_LIMIT = 5;

/**
 * One retrieved chunk. Shape verified against the deployed web
 * controller (commit 8a72295).
 */
export interface RagChunk {
  id: number;
  /** Book/document title, e.g. "Salt Fat Acid Heat". */
  source: string;
  /**
   * Same as `source` today — the web team's privacy doctrine forbids
   * exposing original_filename. Kept as a separate field so future
   * filename surfacing (if ever desired) doesn't break the contract.
   */
  document: string;
  /**
   * Page number, or `null` if the chunker didn't capture one. As of the
   * 2026-04-30 deploy this is **always null** — the corpus chunker
   * doesn't store page numbers. Citation footers degrade gracefully:
   * "Salt Fat Acid Heat" instead of "Salt Fat Acid Heat, p. 142".
   */
  page: number | null;
  /** Full chunk text — not truncated. */
  content: string;
  /**
   * Cosine similarity (0..1) for the vector search path. `0` for the
   * keyword-fallback path. Use the response-level `vectorSearchEnabled`
   * flag to disambiguate "low score" from "keyword-only response".
   */
  score: number;
  /** Admin-UI category ("Food Science and Cooking Principles", etc.). */
  category: string;
}

interface RagResponse {
  chunks: RagChunk[];
  /**
   * Reflects the server's `vector_search_enabled` site setting at
   * request time. `false` means the server fell back to keyword search;
   * `score` values on chunks will all be 0 in that case.
   */
  vectorSearchEnabled: boolean;
}

interface RetrieveOptions {
  /** Max chunks to return, 1..20. Defaults to DEFAULT_LIMIT. */
  limit?: number;
  /**
   * Optional category filter passed straight through to the server's
   * `searchKnowledge`. Useful for future mode-aware retrieval (e.g.
   * "patisserie" mode → "Recipes by Cuisine" only). v1 leaves it unset.
   */
  category?: string;
}

/**
 * Retrieve culinary chunks for a query.
 *
 * Returns `[]` on:
 *   - Network failure (offline, slow connection, DNS)
 *   - 404 (endpoint not yet deployed by web team)
 *   - 429 (rate limited; user just keeps chatting and gets uncited answers
 *     until the window resets)
 *   - 5xx (server error)
 *   - 3-second timeout (web is healthy but slow; don't block inference)
 *
 * Throws ONLY on programming bugs (missing query, etc.) — never on
 * network/server conditions, because the caller (`useAntoine.send()`)
 * shouldn't have to handle them.
 */
export async function retrieve(query: string, options: RetrieveOptions = {}): Promise<RagChunk[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('ragService.retrieve called with empty query');
  }

  const body = {
    query: query.trim(),
    limit: options.limit ?? DEFAULT_LIMIT,
    ...(options.category ? { category: options.category } : {}),
  };

  // Hard timeout. apiClient doesn't expose a per-call timeout yet, so
  // race the fetch against a manual timer. If it times out, we don't
  // cancel the underlying fetch (no AbortSignal threading through
  // apiClient yet) — but we don't await it either, and the fetch's
  // eventual completion is harmless.
  const timeoutPromise = new Promise<RagChunk[]>((resolve) => {
    setTimeout(() => resolve([]), RAG_TIMEOUT_MS);
  });

  const fetchPromise = apiClient
    .post<RagResponse>('/api/mobile/rag/retrieve', body)
    .then((res) => {
      if (!res || !Array.isArray(res.chunks)) return [];
      return res.chunks;
    })
    .catch((e: unknown) => {
      // Silent fallback per the contract above. Logged at info level so
      // a developer tailing logcat can see retrieval is failing without
      // it surfacing to the user.
      if (e instanceof ApiError) {
        console.info(`[ragService] ApiError ${e.status}: ${e.message} — proceeding without RAG`);
      } else if (e instanceof NetworkError) {
        console.info(`[ragService] NetworkError: ${e.message} — proceeding without RAG`);
      } else {
        console.info(`[ragService] Unexpected error, proceeding without RAG`, e);
      }
      return [] as RagChunk[];
    });

  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Per-chunk character cap inside the RAG context block. Chunks coming back
 * from the corpus chunker are sized for desktop RAG (often 1500+ chars =
 * ~500 tokens). On a 1536-token context window we can't afford that. 600
 * chars is roughly 150 tokens — enough to convey one paragraph of
 * culinary detail, tight enough to fit 3 chunks plus the system prompt
 * and user query inside the input budget.
 */
const CHUNK_CHAR_CAP = 400;

function clipChunkContent(content: string): string {
  if (content.length <= CHUNK_CHAR_CAP) return content;
  // Don't slice mid-word; back up to the previous space so the trim reads
  // cleanly. Append an ellipsis so the model sees the truncation explicitly.
  const slice = content.slice(0, CHUNK_CHAR_CAP);
  const lastSpace = slice.lastIndexOf(' ');
  return `${lastSpace > CHUNK_CHAR_CAP - 80 ? slice.slice(0, lastSpace) : slice}…`;
}

/**
 * Format chunks as a single string the model sees as a system message.
 * Citation-aware: chunks are numbered `[1]`, `[2]`... so the model can
 * (and is instructed by the system prompt to) cite them in its reply.
 *
 * Returns null if there are no chunks — caller should omit the system
 * message entirely in that case rather than render an empty Context block.
 */
export function formatRagContext(chunks: RagChunk[]): string | null {
  if (chunks.length === 0) return null;
  const lines = chunks.map((c, i) => {
    const n = i + 1;
    const where = c.page !== null ? `${c.source}, p. ${c.page}` : c.source;
    return `[${n}] ${where}: ${clipChunkContent(c.content)}`;
  });
  return [
    "Reference excerpts from the user's culinary library — cite by [n] when relevant:",
    ...lines,
  ].join('\n');
}
