---
title: On-device inference
category: concept
created: 2026-05-05
updated: 2026-05-05
related: [[antoine]], [[llama-rn-inference-params]], [[streaming-architecture]], [[privacy-invariant]], [[background-download]]
---

How the Antoine model runs locally on the user's phone — no network, no server round-trip, no conversation content leaving the device.

> **Stub.** This page exists to clear the broken-ref check; flesh it out when on-device inference work resumes. See `src/services/inferenceService.ts` for the current implementation and [[llama-rn-inference-params]] for tuned parameters.

## What this covers

- The full lifecycle of a single inference call: prompt assembly → `llama.rn` completion → token stream → UI bubble.
- Where the GGUF model files live on disk after [[background-download]] completes, and how `inferenceService` finds them.
- The privacy boundary: what stays on-device (everything) vs. what crosses the wire (nothing, except optional RAG queries — see [[privacy-invariant]]).
- Lifecycle concerns: model load on app start, context reset between conversations, memory pressure on the Moto G86 Power.

## Pointers until this is filled in

- Implementation: `src/services/inferenceService.ts`
- Parameters + reasoning: [[llama-rn-inference-params]]
- Token streaming UX: [[streaming-architecture]]
- The persona this serves: [[antoine]]
- Privacy guarantees: [[privacy-invariant]]
