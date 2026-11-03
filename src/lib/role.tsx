import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, MyContexts, Role } from "./api";
import { useAuth } from "./auth";

interface RoleState {
  ctx: MyContexts | undefined;
  role: Role | null;
  setRole: (r: Role) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
const Ctx = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const q = useQuery<MyContexts>({
    queryKey: ["me", "contexts", me?.id],
    queryFn: () => api.get("/me/contexts").then((r) => r.data),
    enabled: !!me,
    staleTime: 60_000,
  });
  const [picked, setPicked] = useState<Role | null>(null);
  useEffect(() => {
    if (q.data && picked && !q.data.available_roles.includes(picked)) setPicked(null);
  }, [q.data, picked]);
  const role = q.data ? (picked ?? q.data.default_role) : null;
  return <Ctx.Provider value={{ ctx: q.data, role, setRole: setPicked, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch }}>{children}</Ctx.Provider>;
}
export function useRole() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRole outside RoleProvider");
  return v;
}
