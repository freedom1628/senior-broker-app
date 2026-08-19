"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, AuthContextValue, AuthState, StoredDeskAccount } from "@/types/auth";

const AUTH_STORAGE_KEYS = {
  SESSION_AUTH: "senior_broker_session_auth",
  USER: "senior_broker_user",
  ACCOUNTS: "senior_broker_accounts",
  DESK_LOCKED: "senior_broker_desk_locked",
  LEGACY_AUTH: "senior_broker_auth",
};

const DEFAULT_ACCOUNTS: Record<string, StoredDeskAccount> = {
  "trader@broker.com": {
    id: "usr_desk_senior_1",
    email: "trader@broker.com",
    name: "Senior Desk Trader",
    passcode: "1234",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    accountSize: 15000.0,
    riskPerTrade: 1.0,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  "alex.jones.trader@gmail.com": {
    id: "usr_google_alex_1",
    email: "alex.jones.trader@gmail.com",
    name: "Alex Jones (Swing Desk)",
    passcode: "8888",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    accountSize: 15000.0,
    riskPerTrade: 1.0,
    createdAt: new Date("2026-01-15").toISOString(),
  },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLocked: false,
    currentUser: null,
    authMode: "UNAUTHENTICATED",
    isInitializing: true,
    error: null,
  });

  // Seed default demo accounts in localStorage if not present
  useEffect(() => {
    try {
      const existing = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
      if (!existing) {
        localStorage.setItem(AUTH_STORAGE_KEYS.ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
      }
    } catch {}
  }, []);

  // Hydrate on mount from session/local storage
  useEffect(() => {
    try {
      const cachedSession = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION_AUTH);
      const cachedLegacy = localStorage.getItem(AUTH_STORAGE_KEYS.LEGACY_AUTH);
      const cachedUser = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
      const isLocked = sessionStorage.getItem(AUTH_STORAGE_KEYS.DESK_LOCKED) === "true";

      if ((cachedSession === "true" || cachedLegacy === "true") && cachedUser) {
        const user: User = JSON.parse(cachedUser);
        setState({
          isAuthenticated: true,
          isLocked: isLocked,
          currentUser: user,
          authMode: user.authProvider === "GOOGLE" ? "GOOGLE" : "PIN",
          isInitializing: false,
          error: null,
        });
      } else {
        setState((prev) => ({ ...prev, isInitializing: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isInitializing: false }));
    }
  }, []);

  // Login with 4-digit PIN
  const loginWithPin = useCallback(async (pin: string, email?: string) => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const cleanEmail = (email || "trader@broker.com").toLowerCase().trim();
      const accountsJson = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
      const accounts: Record<string, StoredDeskAccount> = accountsJson ? JSON.parse(accountsJson) : DEFAULT_ACCOUNTS;
      
      let matchedAccount = accounts[cleanEmail];
      // Allow demo PINs to unlock demo profiles
      if (!matchedAccount && (pin === "8888" || pin === "1234")) {
        matchedAccount = pin === "8888" ? accounts["alex.jones.trader@gmail.com"] : accounts["trader@broker.com"];
      }

      if (matchedAccount) {
        if (matchedAccount.passcode !== pin && pin !== "8888" && pin !== "1234") {
          const err = "Invalid 4-digit PIN. Please try again.";
          setState((prev) => ({ ...prev, error: err }));
          return { success: false, error: err };
        }

        const user: User = {
          id: matchedAccount.id,
          email: matchedAccount.email,
          name: matchedAccount.name,
          avatarUrl: matchedAccount.avatarUrl,
          authProvider: "DESK_PIN",
          role: "SENIOR_TRADER",
          accountSize: matchedAccount.accountSize || 15000.0,
          riskPerTrade: matchedAccount.riskPerTrade || 1.0,
          createdAt: matchedAccount.createdAt,
          lastLoginAt: new Date().toISOString(),
        };

        sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION_AUTH, "true");
        sessionStorage.setItem(AUTH_STORAGE_KEYS.DESK_LOCKED, "false");
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_AUTH, "true");

        setState({
          isAuthenticated: true,
          isLocked: false,
          currentUser: user,
          authMode: "PIN",
          isInitializing: false,
          error: null,
        });

        return { success: true };
      }

      const err = "Account not found for this email. Register or use Demo PIN (8888).";
      setState((prev) => ({ ...prev, error: err }));
      return { success: false, error: err };
    } catch (e: any) {
      const err = e?.message || "Authentication failed";
      setState((prev) => ({ ...prev, error: err }));
      return { success: false, error: err };
    }
  }, []);

  // Login with Google (1-Click)
  const loginWithGoogle = useCallback(async (customAccount?: Partial<User>) => {
    setState((prev) => ({ ...prev, error: null }));
    const defaultGoogleUser: User = {
      id: customAccount?.id || `usr_google_${Date.now()}`,
      email: customAccount?.email || "alex.jones.trader@gmail.com",
      name: customAccount?.name || "Alex Jones (Google Authenticated)",
      avatarUrl: customAccount?.avatarUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      authProvider: "GOOGLE",
      role: "SENIOR_TRADER",
      accountSize: 15000.0,
      riskPerTrade: 1.0,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION_AUTH, "true");
    sessionStorage.setItem(AUTH_STORAGE_KEYS.DESK_LOCKED, "false");
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(defaultGoogleUser));
    localStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_AUTH, "true");

    setState({
      isAuthenticated: true,
      isLocked: false,
      currentUser: defaultGoogleUser,
      authMode: "GOOGLE",
      isInitializing: false,
      error: null,
    });
    return { success: true };
  }, []);

  // Register New Desk Account
  const registerDeskAccount = useCallback(async (name: string, email: string, pin: string, accountSize: number = 15000) => {
    setState((prev) => ({ ...prev, error: null }));
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes("@")) {
      const err = "Please enter a valid email address.";
      setState((prev) => ({ ...prev, error: err }));
      return { success: false, error: err };
    }
    if (!pin || pin.length < 4) {
      const err = "Passcode must be at least 4 digits.";
      setState((prev) => ({ ...prev, error: err }));
      return { success: false, error: err };
    }

    const accountsJson = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
    const accounts: Record<string, StoredDeskAccount> = accountsJson ? JSON.parse(accountsJson) : { ...DEFAULT_ACCOUNTS };
    
    if (accounts[cleanEmail]) {
      const err = "An account with this email already exists. Please sign in with PIN.";
      setState((prev) => ({ ...prev, error: err }));
      return { success: false, error: err };
    }

    const newAccount: StoredDeskAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      name: name.trim() || cleanEmail.split("@")[0].toUpperCase() + " Trader",
      passcode: pin,
      accountSize,
      riskPerTrade: 1.0,
      createdAt: new Date().toISOString(),
    };

    accounts[cleanEmail] = newAccount;
    localStorage.setItem(AUTH_STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));

    return loginWithPin(pin, cleanEmail);
  }, [loginWithPin]);

  // Lock Desk (Temporary PIN Screen)
  const lockDesk = useCallback(() => {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.DESK_LOCKED, "true");
    setState((prev) => ({ ...prev, isLocked: true }));
  }, []);

  // Unlock Desk
  const unlockDesk = useCallback(async (pin: string) => {
    setState((prev) => ({ ...prev, error: null }));
    const accountsJson = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
    const accounts: Record<string, StoredDeskAccount> = accountsJson ? JSON.parse(accountsJson) : DEFAULT_ACCOUNTS;
    const currentEmail = state.currentUser?.email || "trader@broker.com";
    const account = accounts[currentEmail];

    const validPin = account?.passcode || "1234";
    if (pin === validPin || pin === "8888" || pin === "1234") {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.DESK_LOCKED, "false");
      setState((prev) => ({ ...prev, isLocked: false }));
      return { success: true };
    }

    const err = "Incorrect PIN. Enter desk passcode (default: 8888 or 1234).";
    setState((prev) => ({ ...prev, error: err }));
    return { success: false, error: err };
  }, [state.currentUser]);

  // Logout
  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION_AUTH);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.DESK_LOCKED);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    localStorage.removeItem(AUTH_STORAGE_KEYS.LEGACY_AUTH);

    setState({
      isAuthenticated: false,
      isLocked: false,
      currentUser: null,
      authMode: "UNAUTHENTICATED",
      isInitializing: false,
      error: null,
    });
  }, []);

  // Update PIN
  const updateDeskPin = useCallback(async (oldPin: string, newPin: string) => {
    if (!newPin || newPin.length < 4) {
      return { success: false, error: "New PIN must be 4 digits." };
    }
    const currentEmail = state.currentUser?.email || "trader@broker.com";
    const accountsJson = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
    const accounts: Record<string, StoredDeskAccount> = accountsJson ? JSON.parse(accountsJson) : DEFAULT_ACCOUNTS;
    
    if (accounts[currentEmail] && accounts[currentEmail].passcode !== oldPin && oldPin !== "8888" && oldPin !== "1234") {
      return { success: false, error: "Current PIN is incorrect." };
    }

    if (accounts[currentEmail]) {
      accounts[currentEmail].passcode = newPin;
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    }
    return { success: true };
  }, [state.currentUser]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        loginWithPin,
        loginWithGoogle,
        registerDeskAccount,
        unlockDesk,
        lockDesk,
        logout,
        updateDeskPin,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
