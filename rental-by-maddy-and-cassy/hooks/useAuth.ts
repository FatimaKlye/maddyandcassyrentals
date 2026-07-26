"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/src/contexts/AuthContext";

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
