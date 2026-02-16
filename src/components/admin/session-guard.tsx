"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE = 2 * 60 * 1000; // Show warning 2 min before timeout
const CHECK_INTERVAL = 30 * 1000;     // Check every 30 seconds

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const lastActivity = useRef(Date.now());
  const warningShown = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset activity timer on user interaction
  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    warningShown.current = false;
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Listen for user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));

    // Periodic check
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;

      // Timeout reached — force logout
      if (idle >= IDLE_TIMEOUT) {
        clearInterval(interval);
        signOut({ callbackUrl: "/admin/login?reason=idle" });
        return;
      }

      // Warning threshold
      if (idle >= IDLE_TIMEOUT - WARNING_BEFORE && !warningShown.current) {
        warningShown.current = true;
        // Could show a toast/modal here — for now just console
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [status, resetActivity]);

  // Block browser tab visibility for extra security
  useEffect(() => {
    if (status !== "authenticated") return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // When tab becomes visible again, check if session expired
        const idle = Date.now() - lastActivity.current;
        if (idle >= IDLE_TIMEOUT) {
          signOut({ callbackUrl: "/admin/login?reason=idle" });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

  return <>{children}</>;
}
