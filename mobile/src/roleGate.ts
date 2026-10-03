import { useEffect } from "react";
import { useRouter } from "expo-router";
import { Role, useAuth } from "./auth";

const homeByRole: Record<Role, string> = {
  admin: "/admin",
  supervisor: "/supervisor",
  customer: "/customer"
};

export function useRequireRole(role: Role) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      router.replace("/login" as never);
      return;
    }
    if (auth.user.role !== role) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, role, router]);

  return auth;
}

export { homeByRole };
