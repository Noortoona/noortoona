import { useEffect } from "react";
import { useRouter } from "expo-router";
import { Role, useAuth } from "./auth";

const homeByRole: Record<Role, string> = {
  admin: "/admin",
  supervisor: "/supervisor",
  customer: "/customer",
  partner: "/partner",
  customer_service: "/staff"
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

  const authorized = !auth.loading && auth.user?.role === role;
  return { ...auth, user: authorized ? auth.user : null, token: authorized ? auth.token : null };
}

export { homeByRole };

export function useRequireStaff() {
  const auth = useAuth();
  const router = useRouter();
  const authorized = !auth.loading && Boolean(auth.user && ["admin", "customer_service"].includes(auth.user.role));
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) router.replace("/login" as never);
    else if (!["admin", "customer_service"].includes(auth.user.role)) router.replace(homeByRole[auth.user.role] as never);
  }, [auth.loading, auth.user, router]);
  return { ...auth, user: authorized ? auth.user : null, token: authorized ? auth.token : null };
}
