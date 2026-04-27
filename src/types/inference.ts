import type { MessageRole } from './chat';

export interface ModelConfig {
  modelPath: string;
  mmprojPath?: string;
  contextSize: number;
  threadCount: number;
}

export interface InferenceMessage {
  role: MessageRole;
  content: string;
}

export interface InferenceResult {
  text: string;
  tokensUsed?: number;
}
