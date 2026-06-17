/**
 * Unit tests for the Vercel AI SDK data-stream parser (chatService's wire
 * decoder). Pure function — no network, no mocks.
 */
import { parseDataStream } from '@/services/dataStream';

describe('parseDataStream', () => {
  it('returns nothing for an empty buffer', () => {
    expect(parseDataStream('')).toEqual({ parts: [], buffer: '' });
  });

  it('decodes a single text part', () => {
    const { parts, buffer } = parseDataStream('0:"hello"\n');
    expect(parts).toEqual([{ type: 'text', value: 'hello' }]);
    expect(buffer).toBe('');
  });

  it('decodes multiple text parts in one buffer, in order', () => {
    const { parts, buffer } = parseDataStream('0:"a"\n0:"b"\n0:"c"\n');
    expect(parts).toEqual([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
      { type: 'text', value: 'c' },
    ]);
    expect(buffer).toBe('');
  });

  it('keeps an incomplete trailing line buffered (no terminating newline)', () => {
    const { parts, buffer } = parseDataStream('0:"complete"\n0:"partia');
    expect(parts).toEqual([{ type: 'text', value: 'complete' }]);
    expect(buffer).toBe('0:"partia');
  });

  it('buffers everything when there is no newline at all', () => {
    expect(parseDataStream('0:"no newline yet')).toEqual({
      parts: [],
      buffer: '0:"no newline yet',
    });
  });

  it('completes a part split across two chunks (caller concatenates leftover)', () => {
    const first = parseDataStream('0:"hel');
    expect(first.parts).toEqual([]);
    expect(first.buffer).toBe('0:"hel');
    const second = parseDataStream(first.buffer + 'lo"\n');
    expect(second.parts).toEqual([{ type: 'text', value: 'hello' }]);
    expect(second.buffer).toBe('');
  });

  it('decodes an error part (code 3)', () => {
    const { parts } = parseDataStream('3:"model exploded"\n');
    expect(parts).toEqual([{ type: 'error', value: 'model exploded' }]);
  });

  it('surfaces non-text/non-error codes as `other` and preserves the code', () => {
    const { parts } = parseDataStream('f:{"messageId":"x"}\nd:{"finishReason":"stop"}\n');
    expect(parts).toEqual([
      { type: 'other', code: 'f' },
      { type: 'other', code: 'd' },
    ]);
  });

  it('mixes text and step/finish parts, keeping only text values', () => {
    const wire = 'f:{"id":"1"}\n0:"Sear "\n0:"the steak"\ne:{"finishReason":"stop"}\n';
    const { parts } = parseDataStream(wire);
    expect(parts).toEqual([
      { type: 'other', code: 'f' },
      { type: 'text', value: 'Sear ' },
      { type: 'text', value: 'the steak' },
      { type: 'other', code: 'e' },
    ]);
  });

  it('ignores blank lines between parts', () => {
    const { parts } = parseDataStream('0:"a"\n\n0:"b"\n');
    expect(parts).toEqual([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
    ]);
  });

  it('treats a buffer of only a newline as empty', () => {
    expect(parseDataStream('\n')).toEqual({ parts: [], buffer: '' });
  });

  it('preserves a colon inside the text payload', () => {
    const { parts } = parseDataStream('0:"ratio is 2:1"\n');
    expect(parts).toEqual([{ type: 'text', value: 'ratio is 2:1' }]);
  });

  it('decodes JSON-escaped quotes inside the text', () => {
    const { parts } = parseDataStream('0:"she said \\"bon appétit\\""\n');
    expect(parts).toEqual([{ type: 'text', value: 'she said "bon appétit"' }]);
  });

  it('decodes a JSON-escaped newline into a real newline in the value', () => {
    const { parts } = parseDataStream('0:"line one\\nline two"\n');
    expect(parts).toEqual([{ type: 'text', value: 'line one\nline two' }]);
  });

  it('handles unicode text', () => {
    const { parts } = parseDataStream('0:"crème brûlée 🍮"\n');
    expect(parts).toEqual([{ type: 'text', value: 'crème brûlée 🍮' }]);
  });

  it('drops a line with no colon separator', () => {
    const { parts } = parseDataStream('garbageline\n0:"ok"\n');
    expect(parts).toEqual([{ type: 'text', value: 'ok' }]);
  });

  it('drops a text part whose JSON payload is malformed', () => {
    const { parts } = parseDataStream('0:not-json\n0:"recovered"\n');
    expect(parts).toEqual([{ type: 'text', value: 'recovered' }]);
  });

  it('ignores a text part whose payload is a non-string JSON value', () => {
    const { parts } = parseDataStream('0:42\n');
    expect(parts).toEqual([]);
  });

  it('handles an empty-string text delta', () => {
    const { parts } = parseDataStream('0:""\n');
    expect(parts).toEqual([{ type: 'text', value: '' }]);
  });

  it('returns leftover after the last newline as the next buffer', () => {
    const { parts, buffer } = parseDataStream('0:"done"\nf:{"trailing');
    expect(parts).toEqual([{ type: 'text', value: 'done' }]);
    expect(buffer).toBe('f:{"trailing');
  });
});
