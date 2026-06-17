/**
 * chatService — streaming client for `POST /api/chat` (api-contracts.md
 * Endpoint E). Replaces the on-device llama.rn inference stack retired in
 * the 2026-06-15 backend-chat pivot.
 *
 * Two things make this endpoint different from every other backend call,
 * so it does NOT go through apiClient:
 *
 *   1. Auth is the `access_token` cookie, not `Authorization: Bearer`
 *      (see webBackendAuth.ts).
 *   2. The response is a live Vercel AI SDK data-stream, not JSON. We must
 *      surface tokens as they arrive.
 *
 * React Native's `fetch` buffers the whole response body (`response.body`
 * is not a readable stream under Hermes), so true incremental streaming is
 * done with `XMLHttpRequest`, whose `onprogress` event exposes the partial
 * `responseText` as bytes land. The wire framing is decoded by the pure
 * `parseDataStream` parser.
 */
import * as Application from 'expo-application';

import { API_BASE_URL } from '@/constants/config';
import type { ChatWireMessage } from '@/types/chat';

import { ApiError, NetworkError } from './__errors__';
import { parseDataStream } from './dataStream';
import { cookieAuthHeaders } from './webBackendAuth';

const APP_VERSION = Application.nativeApplicationVersion ?? 'unknown';

export interface StreamChatParams {
  /** Full prior-turn history plus the new user message, oldest first. */
  messages: ChatWireMessage[];
  /** Opt into the web-search model. Only honoured when enabled server-side. */
  webSearch?: boolean;
  /** Access-token JWT presented as the `access_token` cookie. */
  token: string | null;
  /** Aborts the in-flight request (user navigated away / pressed stop). */
  signal?: AbortSignal;
  /** Invoked for each text delta (`0:` part) as it arrives. */
  onTextDelta: (text: string) => void;
}

/** Raised when the caller aborts the stream via its AbortSignal. */
export class ChatAbortError extends Error {
  constructor() {
    super('Chat stream aborted');
    this.name = 'AbortError';
  }
}

/**
 * Stream a chat completion. Resolves with the full concatenated assistant
 * text once the stream finishes; rejects with `ApiError` (HTTP / stream
 * error), `NetworkError` (transport failure), or `ChatAbortError` (caller
 * aborted). Text deltas are delivered via `onTextDelta` before the promise
 * resolves so the UI can render live.
 */
export function streamChat(params: StreamChatParams): Promise<string> {
  const { messages, webSearch = false, token, signal, onTextDelta } = params;

  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ChatAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/chat`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/plain');
    xhr.setRequestHeader('X-Mobile-App-Version', APP_VERSION);
    const auth = cookieAuthHeaders(token);
    if (auth.Cookie) xhr.setRequestHeader('Cookie', auth.Cookie);

    let consumed = 0; // chars of responseText already fed to the parser
    let buffer = ''; // trailing partial line carried between chunks
    let full = ''; // accumulated assistant text
    let streamError: string | null = null; // first `3:` error part, if any

    /** Feed any newly-arrived response text through the data-stream parser. */
    function drain(): void {
      const fresh = xhr.responseText.slice(consumed);
      if (fresh.length === 0) return;
      consumed = xhr.responseText.length;
      buffer += fresh;
      const { parts, buffer: rest } = parseDataStream(buffer);
      buffer = rest;
      for (const part of parts) {
        if (part.type === 'text') {
          full += part.value;
          onTextDelta(part.value);
        } else if (part.type === 'error' && streamError === null) {
          streamError = part.value;
        }
      }
    }

    function cleanup(): void {
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    function onAbort(): void {
      xhr.abort();
    }

    xhr.onprogress = () => {
      // Error responses (401/429/400) come back as a JSON envelope, not a
      // data-stream — don't feed them to the parser or emit garbage tokens.
      // onload handles the error body once the response completes.
      if (xhr.status >= 400) return;
      drain();
    };

    xhr.onload = () => {
      cleanup();

      if (xhr.status === 401) {
        reject(new ApiError(401, 'Authentication required.'));
        return;
      }
      if (xhr.status >= 400) {
        let message = `Request failed with status ${xhr.status}`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed && typeof parsed.error === 'string') message = parsed.error;
        } catch {
          // Non-JSON error body — keep the generic status message.
        }
        let retryAfter: number | undefined;
        if (xhr.status === 429) {
          const raw = xhr.getResponseHeader('Retry-After');
          const n = raw ? Number.parseInt(raw, 10) : NaN;
          if (Number.isFinite(n) && n >= 0) retryAfter = n;
        }
        reject(new ApiError(xhr.status, message, retryAfter));
        return;
      }

      // Success — flush any final buffered parts. The last SDK part is
      // newline-terminated, so append a sentinel newline to force the
      // parser to emit a trailing line that arrived without its own.
      drain();
      if (buffer.length > 0) {
        const { parts } = parseDataStream(`${buffer}\n`);
        for (const part of parts) {
          if (part.type === 'text') {
            full += part.value;
            onTextDelta(part.value);
          } else if (part.type === 'error' && streamError === null) {
            streamError = part.value;
          }
        }
        buffer = '';
      }

      if (streamError !== null) {
        reject(new ApiError(500, streamError));
        return;
      }
      resolve(full);
    };

    xhr.onerror = () => {
      cleanup();
      reject(new NetworkError(`Failed to reach ${API_BASE_URL}/api/chat`));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new ChatAbortError());
    };

    if (signal) signal.addEventListener('abort', onAbort);

    xhr.send(JSON.stringify({ messages, webSearch }));
  });
}
