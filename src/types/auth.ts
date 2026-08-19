export type AuthProviderType = "DESK_PIN" | "GOOGLE" | "DEMO";
export type AuthMode = "PIN" | "GOOGLE" | "REGISTER" | "UNAUTHENTICATED";
export type TraderRole = "SENIOR_TRADER" | "DESK_ANALYST" | "OBSERVER";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  authProvider: AuthProviderType;
  role: TraderRole;
  accountSize: number; // Default $15,000
  riskPerTrade: number; // Default 1.0% ($150)
  createdAt: string; // ISO-8601 UTC
  lastLoginAt: string; // ISO-8601 UTC
}

export interface StoredDeskAccount {
  id: string;
  email: string;
  name: string;
  passcode: string; // 4-digit PIN / passcode
  avatarUrl?: string;
  accountSize: number;
  riskPerTrade: number;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLocked: boolean;
  currentUser: User | null;
  authMode: AuthMode;
  isInitializing: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  loginWithPin: (pin: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (customAccount?: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  registerDeskAccount: (name: string, email: string, pin: string, accountSize?: number) => Promise<{ success: boolean; error?: string }>;
  unlockDesk: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockDesk: () => void;
  logout: () => void;
  updateDeskPin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}
