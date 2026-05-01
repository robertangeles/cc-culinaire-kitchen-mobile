import { useEffect, useState } from 'react';
import { FlatList, type ListRenderItemInfo, StyleSheet } from 'react-native';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatGreeting } from '@/components/chat/ChatGreeting';
import { CULINARY_VERBS } from '@/constants/culinaryVerbs';
import { spacing } from '@/constants/theme';
import { useConversationStore } from '@/store/conversationStore';
import type { Message } from '@/types/chat';

interface ChatListProps {
  messages: Message[];
  onPressImage?: (uri: string) => void;
}

// Stable ID for the virtual streaming bubble. Lives outside the component
// so React keys stay stable across renders.
const STREAMING_ID = '__streaming__';

// Cadence for rotating culinary verbs during the prefill wait. 2.2s
// reads as alive without flickering; on a 90s cold-prefill turn the
// user sees ~41 verbs roll past without ever repeating (we have 84).
const VERB_ROTATION_MS = 2200;

/**
 * Subtitle text for the in-progress assistant bubble before tokens
 * arrive. Replaces the earlier UX gap where the user saw nothing
 * happening between sending a message and the first token landing
 * (which can be 30–90s on cold first launch due to model load +
 * prompt prefill on a phone CPU).
 *
 * - retrieving / warming → static informative subtitle
 * - streaming pre-tokens → rotating culinary verb (the long wait)
 */
function stageSubtitle(
  stage: 'retrieving' | 'warming' | 'streaming' | null,
  rotatingVerb: string,
): string {
  switch (stage) {
    case 'retrieving':
      return 'Antoine is consulting your library…';
    case 'warming':
      return 'Antoine is warming up…';
    case 'streaming':
      return `Antoine is ${rotatingVerb}…`;
    default:
      return '';
  }
}

/**
 * Pick a fresh verb from CULINARY_VERBS every `intervalMs` while
 * `active` is true. Never repeats the just-shown verb back-to-back.
 * Inert (no interval registered) when inactive, so it costs nothing
 * during the long stretches when the user is reading replies.
 */
function pickVerb(exclude: string): string {
  let next = exclude;
  while (next === exclude) {
    next = CULINARY_VERBS[Math.floor(Math.random() * CULINARY_VERBS.length)] ?? CULINARY_VERBS[0]!;
  }
  return next;
}

function useRotatingCulinaryVerb(active: boolean, intervalMs = VERB_ROTATION_MS): string {
  const [verb, setVerb] = useState(() => pickVerb(''));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setVerb((prev) => pickVerb(prev));
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return verb;
}

export function ChatList({ messages, onPressImage }: ChatListProps) {
  const activeId = useConversationStore((s) => s.activeId);
  const streamingConversationId = useConversationStore((s) => s.streamingConversationId);
  const streamingText = useConversationStore((s) => s.streamingText);
  const streamingStage = useConversationStore((s) => s.streamingStage);

  // Show the virtual streaming bubble whenever a stream targets the
  // currently-active conversation — even before the first token arrives.
  // Pre-token, we render the stage subtitle (`Consulting your library…`,
  // `Warming up…`, or a rotating culinary verb during prefill); once
  // tokens flow we replace it with the live text.
  const isStreamingThisConversation =
    !!activeId && streamingConversationId === activeId && streamingStage !== null;

  // Rotate culinary verbs only while we're in the pre-token wait of the
  // streaming stage — that's the long stretch (~30–90s on cold prefill)
  // where the user has nothing to look at otherwise. Once tokens arrive
  // (`streamingText.length > 0`) the bubble switches to live tokens and
  // the rotation goes inert.
  const isPreTokenStreaming =
    isStreamingThisConversation && streamingStage === 'streaming' && streamingText.length === 0;
  const rotatingVerb = useRotatingCulinaryVerb(isPreTokenStreaming);

  if (messages.length === 0 && !isStreamingThisConversation) {
    return <ChatGreeting />;
  }

  // Bubble content priority: live tokens > stage subtitle.
  const bubbleContent =
    streamingText.length > 0 ? streamingText : stageSubtitle(streamingStage, rotatingVerb);

  const data: Message[] = isStreamingThisConversation
    ? [
        ...messages,
        {
          id: STREAMING_ID,
          conversationId: activeId!,
          role: 'assistant',
          content: bubbleContent,
          createdAt: Date.now(),
        },
      ]
    : messages;

  return (
    <FlatList
      data={data}
      keyExtractor={(m) => m.id}
      renderItem={({ item }: ListRenderItemInfo<Message>) => (
        <ChatBubble message={item} onPressImage={onPressImage} />
      )}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.s3 },
});
