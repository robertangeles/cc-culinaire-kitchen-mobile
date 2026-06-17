/**
 * Unit tests for conversationService — the `/api/conversations` (Endpoint F)
 * client. apiClient is mocked so we assert the exact routes, bodies, and
 * cookie-auth option each function passes.
 */
/* eslint-disable import/first */
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    request: jest.fn(async () => undefined),
  },
}));

import { apiClient } from '@/services/apiClient';
import * as conversationService from '@/services/conversationService';
/* eslint-enable import/first */

const COOKIE = { auth: 'cookie' };

beforeEach(() => jest.clearAllMocks());

describe('conversationService', () => {
  it('createConversation posts id + title with cookie auth (F.1)', async () => {
    await conversationService.createConversation('conv_1', 'Hollandaise help');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/conversations',
      { id: 'conv_1', title: 'Hollandaise help' },
      COOKIE,
    );
  });

  it('listConversations unwraps the conversations array (F.2)', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      conversations: [{ conversationId: 'a' }, { conversationId: 'b' }],
    });
    const result = await conversationService.listConversations();
    expect(apiClient.get).toHaveBeenCalledWith('/api/conversations', COOKIE);
    expect(result).toHaveLength(2);
    expect(result[0]?.conversationId).toBe('a');
  });

  it('getConversation unwraps the conversation object (F.3)', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      conversation: { conversationId: 'c1', messages: [] },
    });
    const result = await conversationService.getConversation('c1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/conversations/c1', COOKIE);
    expect(result.conversationId).toBe('c1');
  });

  it('getConversation URL-encodes the id', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ conversation: { messages: [] } });
    await conversationService.getConversation('a/b c');
    expect(apiClient.get).toHaveBeenCalledWith('/api/conversations/a%2Fb%20c', COOKIE);
  });

  it('postMessages sends the message array to the messages route (F.4)', async () => {
    const messages = [
      { messageId: 'm1', messageRole: 'user' as const, messageBody: 'hi', messageSequence: 0 },
    ];
    await conversationService.postMessages('conv_1', messages);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/conversations/conv_1/messages',
      { messages },
      COOKIE,
    );
  });

  it('updateTitle issues a PATCH with cookie auth (F.5)', async () => {
    await conversationService.updateTitle('conv_1', 'Better title');
    expect(apiClient.request).toHaveBeenCalledWith('/api/conversations/conv_1', {
      method: 'PATCH',
      body: { title: 'Better title' },
      auth: 'cookie',
    });
  });

  it('deleteConversation calls del on the encoded route (F.6)', async () => {
    await conversationService.deleteConversation('conv_1');
    expect(apiClient.del).toHaveBeenCalledWith('/api/conversations/conv_1', COOKIE);
  });

  it('propagates errors from apiClient', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(conversationService.createConversation('x', 'y')).rejects.toThrow('boom');
  });
});
