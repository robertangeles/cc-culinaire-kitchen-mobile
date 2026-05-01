import type { MessageRole } from './chat';

export interface ModelConfig {
  modelPath: string;
  mmprojPath?: string;
  contextSize: number;
  threadCount: number;
}

/**
 * Multimodal content parts. Matches llama.rn's `RNLlamaMessagePart`
 * shape so the message array can be passed straight to
 * `native.completion` without translation. Use the array form when a
 * user message carries an image attachment AND the multimodal
 * projector is initialized; the plain-string form remains the default
 * for text-only turns and assistant replies.
 */
export type InferenceMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface InferenceMessage {
  role: MessageRole;
  content: string | InferenceMessageContentPart[];
}

export interface InferenceResult {
  text: string;
  tokensUsed?: number;
}
