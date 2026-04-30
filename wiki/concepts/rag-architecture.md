---
title: RAG architecture — grounding Antoine in the user's culinary library
category: concept
created: 2026-04-30
updated: 2026-04-30
related: [[antoine]], [[privacy-invariant]], [[server-managed-prompts]], [[web-backend]]
---

How Antoine consults the indexed culinary corpus on the web at query time, and how the chunks it retrieves shape the on-device inference call.

## The flow

```
ChatComposer.onSend(text)
  → useAntoine.send(text)
     1. Persist USER message → SQLite
     2. setStreamingStage('retrieving')
     3. Promise.all([
          getActivePrompt(),                  ← cached server prompt; baked-in fallback
          retrieve(text, { limit: 5 }),       ← POST /api/mobile/rag/retrieve
        ])
     4. setStreamingStage('warming')
     5. ensureContext()                       ← llama.rn initContext (cached after first call)
     6. setStreamingStage('streaming')
     7. inferenceService.completion(ctx, {
          messages: [
            { role: 'system', content: cachedPrompt },
            ...(chunks.length ? [{ role: 'system', content: formatRagContext(chunks) }] : []),
            ...history,
            { role: 'user', content: text },
          ],
        }, onToken)
     8. commitStreaming → SQLite
        ↳ assistant message body = streamed text + Sources footer (if chunks were retrieved)
```

## Why a single round trip for retrieval

The corpus is 4,400+ chunks across 18 culinary books (Salt Fat Acid Heat, On Food and Cooking, The Flavor Bible, Mastering the Art of French Cooking, etc.). It is too large to ship inside the APK, would be stale within a release cycle, and the embedding/retrieval infrastructure already exists on the web backend. Doing retrieval on the device would mean shipping a vector index + embedding model + chunk store — a different product.

So one and only one network call happens at query time: **the user's current message goes out, the top-k chunks come back**. Conversation history is never sent. The response is generated entirely on device by `llama.rn`.

## The contract (deployed 2026-04-30, web commit 8a72295)

```
POST /api/mobile/rag/retrieve
Auth: Bearer (required)
Rate limit: 60 req/min/user

Request body:
  { query: string, limit?: number (1..20, default 5), category?: string }

200 response:
  {
    chunks: [
      {
        id: number,
        source: string,            // e.g. "Salt Fat Acid Heat"
        document: string,          // === source today; reserved
        page: number | null,       // currently always null — chunker doesn't store pages
        content: string,           // full chunk text, untruncated
        score: number,             // cosine similarity (0..1) for vector path; 0 for keyword fallback
        category: string,          // admin-UI category label
      }
    ],
    vectorSearchEnabled: boolean,  // false → server fell back to keyword search
  }

Empty results return 200 with chunks: [] — never 404.
401 → apiClient handles refresh + retry.
```

## Citation formatting

`formatRagContext()` produces a single string the model sees as a system message. The chunks are numbered `[1]`, `[2]`, ... so the model can cite them in its reply. The system prompt (server-managed) is responsible for instructing Antoine to use those `[n]` citations.

```
Reference excerpts from the user's culinary library — cite by [n] when relevant:
[1] Salt Fat Acid Heat, p. 142: ...
[2] On Food and Cooking, p. 89: ...
```

When `page === null` (current production state — the chunker doesn't store pages), the format degrades gracefully:

```
[1] Salt Fat Acid Heat: ...
```

**RAG chunks are private to the model.** The chunk text, source titles, and page numbers go into the system message ONLY. They are never appended to the committed assistant message and never rendered in the chat UI. Antoine's inline `[n]` citations within his reply are the only user-visible reference to the corpus — the user sees the citation but not the underlying chunk. (An earlier iteration appended a visible `---\nSources:\n[1] ...` footer to the committed message; that was reverted on 2026-04-30 because it leaked corpus titles into a UI that should display only the assistant's words.)

## Timeout policy: 3 seconds, silent fallback

`ragService.retrieve()` enforces a 3-second hard timeout via `Promise.race([fetchPromise, timeoutPromise])`. If the web is slow, offline, returns 4xx/5xx, or the response shape is malformed, the function returns `[]` and inference proceeds without retrieval. The user sees no error; the model simply has no `[n]` references to cite that turn.

This is deliberate: we'd rather answer without context than make the user wait an extra five seconds for a question Antoine can probably handle from training. The user's earlier feedback ("don't leave silent gaps") is satisfied by the streaming-bubble subtitle ("Antoine is consulting your library…") — they see the consultation happen, and if it returns nothing, the bubble simply transitions to "warming up…" → tokens.

The 3s timeout applies only to the JavaScript-side wait. The underlying `apiClient.post` doesn't yet thread an `AbortSignal` through, so the fetch completes in the background — but its result is dropped.

## Streaming-bubble stages

Driven by `conversationStore.streamingStage` which the hook drives through three values:

| Stage        | Subtitle on the streaming bubble      |
| ------------ | ------------------------------------- |
| `retrieving` | "Antoine is consulting your library…" |
| `warming`    | "Antoine is warming up…"              |
| `streaming`  | (token text appears; subtitle hidden) |

The bubble is rendered virtually — it doesn't hit SQLite until commit. Per-token writes were rejected during planning (would burn write amplification on the device's SQLite for no user-visible benefit).

## Failure modes and degradation

| Condition              | Behavior                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Network offline        | 3s timeout fires, `retrieve()` returns `[]`, inference proceeds, no Sources footer.    |
| Web 5xx / 503          | Caught as `ApiError`, returns `[]`, info-logged, inference proceeds.                   |
| Web 429 (rate limited) | Same — returns `[]`, user keeps chatting and gets uncited answers until window resets. |
| Empty corpus result    | 200 with `chunks: []`, no RAG block injected, no Sources footer.                       |
| Malformed response     | Returns `[]`, info-logged.                                                             |
| Auth token expired     | `apiClient` handles refresh + retry single-flight; transparent to caller.              |

In every failure mode, **inference still streams** and Antoine still answers — just from training-only, no citations.

## Privacy boundary

This concept is the reason `wiki/concepts/privacy-invariant.md` was rewritten on 2026-04-30. The query crosses the boundary; the response and history do not. See [[privacy-invariant]] for the full audit list.

## See also

- [[privacy-invariant]] — what crosses the boundary and what doesn't
- [[server-managed-prompts]] — the sister fetch (system prompt) shares the cache-with-fallback pattern
- [[antoine]] — the persona that becomes a "private culinary librarian" only because of this flow
- `src/services/ragService.ts` — the implementation
- `src/hooks/useAntoine.ts` — orchestration in `send()`
