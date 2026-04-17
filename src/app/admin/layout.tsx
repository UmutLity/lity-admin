"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/topbar";
import { SessionGuard } from "@/components/admin/session-guard";
import { AdminLoadingScreen } from "@/components/admin/admin-loading-screen";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (status === "unauthenticated" && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [status, isLoginPage, router]);

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (status === "loading") {
    return <AdminLoadingScreen message="Checking your session..." />;
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  return (
    <SessionGuard>
      <div className="admin-shell min-h-screen">
        <Sidebar />
        <div className={cn(
          "transition-all duration-300 ease-in-out min-h-screen flex flex-col",
          collapsed ? "lg:ml-[88px]" : "lg:ml-[292px]"
        )}>
          <AdminHeader />
          <main className="flex-1">
            <div className="page-enter mx-auto w-full max-w-[1680px] p-4 lg:p-6">
              <div className="admin-surface p-3 sm:p-4 lg:p-5">
              {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </SidebarProvider>
  );
}
