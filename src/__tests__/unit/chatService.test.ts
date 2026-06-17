/**
 * Unit tests for chatService.streamChat. The streaming transport is
 * XMLHttpRequest (RN fetch can't stream response bodies), so we install a
 * controllable fake XHR and drive its progress/load/error events by hand.
 */
import { ApiError, NetworkError } from '@/services/__errors__';
import { ChatAbortError, streamChat } from '@/services/chatService';

type Handler = (() => void) | null;

class FakeXHR {
  static last: FakeXHR | null = null;

  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: string | undefined;
  status = 200;
  responseText = '';
  responseHeaders: Record<string, string> = {};

  onprogress: Handler = null;
  onload: Handler = null;
  onerror: Handler = null;
  onabort: Handler = null;
  aborted = false;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  getResponseHeader(key: string): string | null {
    return this.responseHeaders[key] ?? null;
  }
  send(body?: string) {
    this.body = body;
    FakeXHR.last = this;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  // --- test helpers -------------------------------------------------------
  /** Simulate a chunk of streamed bytes landing. */
  pushChunk(text: string) {
    this.responseText += text;
    this.onprogress?.();
  }
  /** Simulate the response completing with a status code. */
  finish(status = 200) {
    this.status = status;
    this.onload?.();
  }
}

const ORIGINAL_XHR = (global as Record<string, unknown>).XMLHttpRequest;

beforeEach(() => {
  (global as Record<string, unknown>).XMLHttpRequest = FakeXHR as unknown;
  FakeXHR.last = null;
});

afterEach(() => {
  (global as Record<string, unknown>).XMLHttpRequest = ORIGINAL_XHR;
});

function lastXHR(): FakeXHR {
  if (!FakeXHR.last) throw new Error('no XHR was sent');
  return FakeXHR.last;
}

describe('streamChat', () => {
  it('streams text deltas and resolves with the full concatenated text', async () => {
    const deltas: string[] = [];
    const promise = streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      token: 'jwt',
      onTextDelta: (d) => deltas.push(d),
    });

    const xhr = lastXHR();
    xhr.pushChunk('0:"Hel"\n');
    xhr.pushChunk('0:"lo, "\n0:"chef"\n');
    xhr.finish(200);

    await expect(promise).resolves.toBe('Hello, chef');
    expect(deltas).toEqual(['Hel', 'lo, ', 'chef']);
  });

  it('sends the messages array with webSearch defaulting to false', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    expect(JSON.parse(xhr.body as string)).toEqual({
      messages: [{ role: 'user', content: 'q' }],
      webSearch: false,
    });
    xhr.finish(200);
    await promise;
  });

  it('forwards webSearch=true in the body', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      webSearch: true,
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    expect(JSON.parse(xhr.body as string).webSearch).toBe(true);
    xhr.finish(200);
    await promise;
  });

  it('authenticates via the access_token cookie, not Authorization', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt-xyz',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    expect(xhr.headers.Cookie).toBe('access_token=jwt-xyz');
    expect(xhr.headers.Authorization).toBeUndefined();
    expect(xhr.url).toContain('/api/chat');
    xhr.finish(200);
    await promise;
  });

  it('omits the cookie when there is no token', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: null,
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    expect(xhr.headers.Cookie).toBeUndefined();
    xhr.finish(200);
    await promise;
  });

  it('rejects with a 401 ApiError on unauthorized', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    xhr.responseText = JSON.stringify({ error: 'Authentication required.' });
    xhr.finish(401);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });

  it('rejects with a 429 ApiError carrying Retry-After', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    xhr.responseText = JSON.stringify({ error: 'Slow down' });
    xhr.responseHeaders['Retry-After'] = '30';
    xhr.finish(429);
    await expect(promise).rejects.toMatchObject({ status: 429, retryAfter: 30 });
  });

  it('rejects with the parsed error message on a 400', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    xhr.responseText = JSON.stringify({ error: 'messages required' });
    xhr.finish(400);
    await expect(promise).rejects.toThrow('messages required');
  });

  it('does not emit tokens for an error response body', async () => {
    const deltas: string[] = [];
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: (d) => deltas.push(d),
    });
    const xhr = lastXHR();
    xhr.status = 400; // status known before progress fires
    xhr.pushChunk(JSON.stringify({ error: 'bad' }));
    xhr.finish(400);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(deltas).toEqual([]);
  });

  it('rejects with a NetworkError when the transport fails', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    xhr.onerror?.();
    await expect(promise).rejects.toBeInstanceOf(NetworkError);
  });

  it('surfaces a streamed error part (code 3) as a 500 ApiError', async () => {
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    xhr.pushChunk('3:"generation failed"\n');
    xhr.finish(200);
    await expect(promise).rejects.toMatchObject({ status: 500, message: 'generation failed' });
  });

  it('flushes a final part that arrives without a trailing newline', async () => {
    const deltas: string[] = [];
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      onTextDelta: (d) => deltas.push(d),
    });
    const xhr = lastXHR();
    xhr.responseText = '0:"no trailing newline"';
    xhr.finish(200);
    await expect(promise).resolves.toBe('no trailing newline');
    expect(deltas).toEqual(['no trailing newline']);
  });

  it('rejects immediately with ChatAbortError if the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      signal: controller.signal,
      onTextDelta: () => {},
    });
    await expect(promise).rejects.toBeInstanceOf(ChatAbortError);
    expect(FakeXHR.last).toBeNull(); // never opened a request
  });

  it('aborts the in-flight request when the signal fires', async () => {
    const controller = new AbortController();
    const promise = streamChat({
      messages: [{ role: 'user', content: 'q' }],
      token: 'jwt',
      signal: controller.signal,
      onTextDelta: () => {},
    });
    const xhr = lastXHR();
    controller.abort();
    expect(xhr.aborted).toBe(true);
    await expect(promise).rejects.toBeInstanceOf(ChatAbortError);
  });
});
