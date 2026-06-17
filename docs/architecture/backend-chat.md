# Backend chat architecture (2026-06-15 pivot)

The mobile app no longer runs inference on-device. Antoine now answers via the
existing CulinAIre Kitchen web backend. On-device `llama.rn`, the GGUF model
download, the on-device RAG retrieval, and the server-managed prompt cache are
all retired.

## Data flow

```
ChatScreen
  └─ useAntoine.send(text)
       1. ensure active conversation (conversationStore.startNew → backend F.1)
       2. conversationStore.addMessage(user)        → SQLite mirror + backend F.4
       3. chatService.streamChat({ messages, token })→ POST /api/chat (Endpoint E)
            └─ onTextDelta → conversationStore.appendStreamingToken (live bubble)
       4. conversationStore.commitStreaming(text)    → SQLite mirror + backend F.4
```

## Auth — cookie, not Bearer

Unlike the mobile-only endpoints A–D (`Authorization: Bearer` via `apiClient`),
the chat + conversation surface (Endpoints E and F) runs through the backend's
`authenticateOrGuest` middleware, which reads the JWT from the `access_token`
**cookie** (`req.cookies.access_token`). Mobile is subscription-gated and has
no guest flow, so the logged-in user's access token is always presented as that
cookie.

- `src/services/webBackendAuth.ts` — `cookieAuthHeaders(token)` builds
  `{ Cookie: 'access_token=<jwt>' }`.
- `src/services/apiClient.ts` — new `auth: 'cookie'` request option; the
  401-refresh-retry re-presents the refreshed token in the same form.

## Streaming transport

React Native's `fetch` buffers the whole response body (`response.body` is not
a readable stream under Hermes), so `chatService.streamChat` uses
`XMLHttpRequest` and reads `responseText` incrementally on `onprogress`. The
wire format is the Vercel AI SDK **data-stream** (header
`X-Vercel-AI-Data-Stream: v1`): newline-delimited `<typeCode>:<json>` parts.
`src/services/dataStream.ts` is the pure parser — `0:` text deltas concatenate
into the reply, `3:` is a stream error, every other code is ignored.

## Source of truth + offline mirror

The backend is the source of truth for conversation content.
`conversationStore`:

- **Reads** (`hydrate`, `setActive`) fetch from the backend first, falling back
  to the local SQLite mirror when offline.
- **Writes** (`startNew`, `addMessage`, `commitStreaming`, `removeConversation`,
  `clearAllConversations`) write SQLite first (instant, offline-durable) then
  push to the backend best-effort. The existing `isSynced` flag records whether
  the backend write landed; a failed push leaves the row `isSynced=false`.

### Known gaps (tracked in shared-context/mobile-needs.md)

- Per-conversation `language` override is SQLite-only (the backend conversation
  API does not model it) — it does not round-trip through a backend hydrate.
- The mirror caches only this device's own writes; conversations created on
  another device show live but are not written into SQLite for offline reads.

## Privacy posture change

This pivot intentionally reverses the prior "conversation content never leaves
the device" invariant (decisions.md 2026-06-15). Conversation content now
persists to the backend conversation store.
