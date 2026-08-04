"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { subscribeToAuthChanges } from "@/src/services/authService";
import { isActiveAdmin } from "@/src/services/adminService";
import { getUserProfile } from "@/src/services/userService";
import type { UserProfile } from "@/src/types/database";

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadAccount() {
    const [userProfile, adminAccess] = await Promise.all([
      getUserProfile(user?.id ?? "").catch(() => null),
      isActiveAdmin().catch(() => false),
    ]);
    setProfile(userProfile);
    setIsAdmin(adminAccess);
  }

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (nextUser) => {
      setUser(nextUser);
      setLoading(true);

      try {
        if (nextUser) {
          const [userProfile, adminAccess] = await Promise.all([
            getUserProfile(nextUser.id).catch(() => null),
            isActiveAdmin().catch(() => false),
          ]);
          setProfile(userProfile);
          setIsAdmin(adminAccess);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      } catch {
        setProfile(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function refreshProfile() {
    if (user) {
      await loadAccount();
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
