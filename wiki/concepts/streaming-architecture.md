---
title: Streaming token architecture
category: concept
created: 2026-04-29
updated: 2026-04-29
related: [[antoine]], [[llama-rn-inference-params]], [[privacy-invariant]]
---

How tokens flow from `llama.rn`'s native completion callback through Zustand to the rendered chat bubble, without per-token SQLite writes and without changing the `messages` table schema.

## The problem

The naïve approach is to append each streamed token to an in-progress `Message` row in SQLite and let the FlatList re-render. That's 10–30 writes per second per reply, on a phone, while the model is also burning CPU. It also requires a `streaming` or `pending` column on `ckm_message` — a real schema change for a feature that's purely UI ephemeral.

## The pattern

The streaming text is **transient state in Zustand**, not a SQLite row. The chat list renders a virtual "in-progress" assistant bubble at the bottom whenever streaming is active. Only the final, completed reply lands in SQLite.

```
llama.rn callback (per token)
  → useAntoine.send() captures token
  → conversationStore.appendStreamingToken(text)
  → streamingText: 'partial reply...'
  → ChatList subscribes to streamingText, re-renders the virtual bubble

llama.rn promise resolves (final text)
  → useAntoine.send() calls commitStreaming(conversationId, fullText)
  → SQLite write: one INSERT into ckm_message
  → streamingConversationId: null, streamingText: ''
  → ChatList swaps the virtual bubble for the persisted bubble
```

## State shape

Two new fields on `useConversationStore`:

```ts
streamingConversationId: string | null; // which conversation the stream targets
streamingText: string; // accumulated text so far
```

Three new actions:

```ts
startStreaming(conversationId: string)              // clear any prior text, set target
appendStreamingToken(text: string)                  // append to streamingText
commitStreaming(conversationId: string, finalText)  // INSERT message, clear streaming
clearStreaming()                                    // bail out (error path)
```

Why two state fields instead of one combined object: Zustand selectors are equality-checked by reference. Splitting `streamingText` from `streamingConversationId` lets `ChatList` subscribe to the text alone — every token append re-renders only the bubble, not the whole list shell.

## Rendering the virtual bubble

`ChatList` renders the virtual bubble when:

1. `streamingConversationId === activeConversationId` (the stream targets the conversation we're looking at)
2. `streamingText.length > 0` (we've received at least one token)

The virtual bubble is a `Message` shape with `id: '__streaming__'` and the live `streamingText` as content. When `commitStreaming` finalizes, the streaming state clears and a real persisted bubble takes its place. The user sees a smooth handoff — same visual position, same content.

## Why no token throttling (yet)

llama.rn fires the callback at the model's token rate — ~10–30 tokens/second on a Moto G86 Power for Gemma 3-4B. That's well within React 19 + Reanimated's render budget. One Zustand `set` per token is fine.

If we ever measure render thrash on device (visible jank during streaming), the mitigation is a 50ms `requestAnimationFrame` coalescer inside `appendStreamingToken` that batches incoming tokens before pushing to state. Deferred until measurement justifies it — premature optimization risks hiding inference bugs behind a debounce.

## Race conditions

**User navigates away mid-stream.** `commitStreaming` uses the conversationId captured at `startStreaming` time, so the assistant message lands in the original conversation regardless of the active screen. The virtual bubble disappears from the screen the user navigated to (because `streamingConversationId !== activeConversationId`). Acceptable.

**User sends a second message before the first reply finishes.** Currently not handled — the existing `useAntoine.send()` flow doesn't gate a second send on the first stream completing. Practically, the cold-load + thinking gate usually serializes things. Real fix: add a `disabled` state to ChatComposer when `isThinking || streamingConversationId !== null`. Tracked as a follow-up.

**Stop tokens leaking into rendered text.** llama.rn surfaces every token including chat-template markers. `inferenceService.completion` filters `<end_of_turn>`, `<|end_of_turn|>`, `<eos>`, `</s>`, `<|endoftext|>` out of the streaming callback before it reaches the store. The full set is in `STOP_TOKENS` in `src/services/inferenceService.ts`.

## Privacy invariant

Conversation content stays on device — even mid-stream. The `streamingText` lives only in JS memory and is never written anywhere except the eventual SQLite row at commit time. No analytics SDK has access to Zustand state in this app. See [[privacy-invariant]].

## See also

- [[antoine]] — the AI persona being streamed
- [[llama-rn-inference-params]] — the params that produce these tokens
- `src/services/inferenceService.ts` — `completion()` with streaming callback
- `src/store/conversationStore.ts` — streaming slice
- `src/hooks/useAntoine.ts` — orchestration
- `src/components/chat/ChatList.tsx` — virtual bubble rendering
