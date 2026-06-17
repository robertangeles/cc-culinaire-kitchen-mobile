/**
 * dataStream — parser for the Vercel AI SDK data-stream protocol (v1).
 *
 * `POST /api/chat` streams `streamText(...).toDataStream()` straight to the
 * HTTP response with the header `X-Vercel-AI-Data-Stream: v1`. The wire
 * format is newline-delimited parts, each shaped `<typeCode>:<json>\n`
 * (see shared-context/api-contracts.md, Endpoint E). It is NOT JSON and NOT
 * SSE `event:`/`data:` framing.
 *
 * Type codes we care about:
 *   - `0:` — a text delta. The JSON payload is a string, e.g.
 *            `0:"Angelica pairs beautifully with…"`. These concatenate
 *            into the assistant's visible reply.
 *   - `3:` — an error. The JSON payload is a string error message.
 * Every other code (tool calls, step/finish markers `9: a: d: e: f: …`) is
 * surfaced as `other` and ignored by the chat UI.
 *
 * This module is intentionally pure (no I/O). The transport in
 * `chatService.ts` feeds it raw response text incrementally; the parser
 * extracts only the COMPLETE lines and hands back any trailing partial line
 * as `buffer` so the next chunk can finish it. That makes streaming robust
 * to a single SDK part being split across two network chunks, and makes the
 * framing logic exhaustively unit-testable without a network.
 */

export type DataStreamPart =
  | { type: 'text'; value: string }
  | { type: 'error'; value: string }
  | { type: 'other'; code: string };

export interface ParsedDataStream {
  /** Complete parts decoded from the buffer, in order. */
  parts: DataStreamPart[];
  /** Trailing incomplete line (no terminating newline yet), kept for next call. */
  buffer: string;
}

/**
 * Decode one line of the data-stream wire format (`<code>:<json>`). Returns
 * `null` for blank lines or lines whose JSON payload fails to parse (a
 * partial part that should never reach here once line-splitting is correct,
 * but guarded so a single malformed part can't throw mid-stream).
 */
function decodeLine(line: string): DataStreamPart | null {
  if (line.length === 0) return null;
  const sep = line.indexOf(':');
  if (sep <= 0) return null;
  const code = line.slice(0, sep);
  const rawJson = line.slice(sep + 1);

  if (code === '0') {
    try {
      const value = JSON.parse(rawJson);
      if (typeof value === 'string') return { type: 'text', value };
    } catch {
      return null;
    }
    return null;
  }

  if (code === '3') {
    try {
      const value = JSON.parse(rawJson);
      return { type: 'error', value: typeof value === 'string' ? value : String(value) };
    } catch {
      return null;
    }
  }

  return { type: 'other', code };
}

/**
 * Parse all COMPLETE newline-terminated parts out of `buffer`. Any text
 * after the final newline is returned as the leftover `buffer` for the next
 * call. A `buffer` that ends in `\n` yields an empty leftover.
 */
export function parseDataStream(buffer: string): ParsedDataStream {
  const lastNewline = buffer.lastIndexOf('\n');
  if (lastNewline === -1) {
    // No complete line yet — keep everything buffered.
    return { parts: [], buffer };
  }

  const complete = buffer.slice(0, lastNewline);
  const leftover = buffer.slice(lastNewline + 1);

  const parts: DataStreamPart[] = [];
  for (const line of complete.split('\n')) {
    const part = decodeLine(line);
    if (part) parts.push(part);
  }

  return { parts, buffer: leftover };
}
