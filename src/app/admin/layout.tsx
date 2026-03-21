"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/topbar";
import { SessionGuard } from "@/components/admin/session-guard";
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,#040814,#08101f)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/[0.08] border-t-sky-400" />
          </div>
          <p className="text-xs text-zinc-600 font-medium">Loading...</p>
        </div>
      </div>
    );
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
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        )}>
          <AdminHeader />
          <main className="flex-1">
            <div className="page-enter mx-auto w-full max-w-[1480px] p-5 lg:p-8">
              {children}
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
