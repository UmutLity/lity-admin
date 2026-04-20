"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { AdminI18nProvider } from "@/lib/admin-i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminI18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </AdminI18nProvider>
    </SessionProvider>
  );
}
