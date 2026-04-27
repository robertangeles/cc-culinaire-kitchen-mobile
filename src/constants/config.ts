export const APP_NAME = 'CulinAIre Kitchen';
export const ASSISTANT_NAME = 'Antoine';

export const API_BASE_URL = 'https://api.culinaire-kitchen.example/v1';

export const MODEL = {
  id: 'antoine',
  displayName: 'Antoine',
  filename: 'gemma-4-e4b-it.Q4_K_M.gguf',
  mmprojFilename: 'gemma-4-e4b-it.BF16-mmproj.gguf',
  sizeBytes: 4_970_000_000 + 920_000_000,
  cdnUrl: 'https://cdn.culinaire-kitchen.example/models/antoine/v1/',
} as const;

export const STORAGE_KEYS = {
  authToken: 'ckm_auth_token',
  authRefreshToken: 'ckm_auth_refresh_token',
  modelDir: 'ckm_model_dir',
} as const;
