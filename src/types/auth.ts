export interface User {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}
