import { useCallback, useState } from 'react';

/**
 * Stub hook during the backend-chat pivot. The on-device llama.rn
 * inference stack has been removed; the backend API integration is the
 * next chunk of work. Until then `send` is a no-op so the chat UI keeps
 * compiling and existing screens stay rendered.
 */
export function useAntoine() {
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (_content: string) => {
    setError(null);
    setIsThinking(false);
  }, []);

  return { send, isThinking, error };
}
