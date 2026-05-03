/**
 * Streaming slice tests for conversationStore. Mocks the SQLite query
 * modules so we can assert pure store behavior without touching a real DB.
 *
 * eslint-disable-next-line import/first — jest.mock calls must precede
 * the module imports that load the mocked modules.
 */
/* eslint-disable import/first */
jest.mock('@/db/queries/messages', () => ({
  insert: jest.fn(async () => undefined),
  listByConversation: jest.fn(async () => []),
  deleteByConversation: jest.fn(async () => undefined),
}));

jest.mock('@/db/queries/conversations', () => ({
  insert: jest.fn(async () => undefined),
  listByUser: jest.fn(async () => []),
  touch: jest.fn(async () => undefined),
  setTitle: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  removeAllForUser: jest.fn(async () => undefined),
}));

import * as messageQueries from '@/db/queries/messages';
import { useConversationStore } from '@/store/conversationStore';
/* eslint-enable import/first */

describe('conversationStore — streaming slice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConversationStore.setState({
      conversations: [],
      activeId: null,
      messages: {},
      streamingConversationId: null,
      streamingText: '',
      dbReady: true,
    });
  });

  it('starts in a non-streaming state', () => {
    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');
  });

  it('startStreaming sets the conversation id and clears any prior text', () => {
    useConversationStore.setState({ streamingText: 'leftover' });
    useConversationStore.getState().startStreaming('conv_a');
    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBe('conv_a');
    expect(s.streamingText).toBe('');
  });

  it('appendStreamingToken accumulates tokens', () => {
    const { startStreaming, appendStreamingToken } = useConversationStore.getState();
    startStreaming('conv_a');
    appendStreamingToken('hello ');
    appendStreamingToken('world');
    expect(useConversationStore.getState().streamingText).toBe('hello world');
  });

  it('commitStreaming persists the final message and clears streaming state', async () => {
    const conversationId = 'conv_a';
    useConversationStore.setState({
      messages: { [conversationId]: [] },
    });
    const { startStreaming, appendStreamingToken, commitStreaming } =
      useConversationStore.getState();
    startStreaming(conversationId);
    appendStreamingToken('hello ');
    appendStreamingToken('world');
    await commitStreaming(conversationId, 'hello world');

    expect(messageQueries.insert).toHaveBeenCalledTimes(1);
    const insertCall = (messageQueries.insert as jest.Mock).mock.calls[0][0];
    expect(insertCall.role).toBe('assistant');
    expect(insertCall.content).toBe('hello world');
    expect(insertCall.conversationId).toBe(conversationId);

    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');
    expect(s.messages[conversationId]?.length).toBe(1);
    expect(s.messages[conversationId]?.[0]?.content).toBe('hello world');
  });

  it('clearStreaming bails out without persisting', () => {
    const { startStreaming, appendStreamingToken, clearStreaming } =
      useConversationStore.getState();
    startStreaming('conv_a');
    appendStreamingToken('partial');
    clearStreaming();
    expect(messageQueries.insert).not.toHaveBeenCalled();
    const s = useConversationStore.getState();
    expect(s.streamingConversationId).toBeNull();
    expect(s.streamingText).toBe('');
  });
});
