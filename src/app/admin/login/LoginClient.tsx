"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Clock, LockKeyhole } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);

  useEffect(() => {
    if (searchParams.get("reason") === "idle") {
      setIdleWarning(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/admin");
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d1016]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:44px_44px] opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 lg:px-8">
        <section className="flex w-full flex-col items-center justify-center gap-5">
          <div className="w-full max-w-[430px] rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Control Center</p>
            <p className="mt-1 text-sm text-zinc-300">Manage products, orders, tickets and release updates from one panel.</p>
          </div>
          <div className="w-full max-w-[430px] rounded-[32px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(23,23,31,0.96),rgba(15,15,22,0.96))] p-7 shadow-[0_34px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] shadow-[0_16px_34px_rgba(109,40,217,0.28)]">
                  <Image
                    src="/litysoftware.png"
                    alt="Lity Software Logo"
                    width={26}
                    height={26}
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Admin Sign In</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Continue with your admin credentials.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Panel</p>
                <p className="mt-1 text-sm font-medium text-zinc-200">Lity Admin</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {idleWarning && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>Session expired because of inactivity. Please sign in again.</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="admin@company.com"
                    className="h-12 w-full rounded-2xl border border-white/[0.07] bg-[#15151d] px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-violet-400/35 focus:bg-[#181821]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      Password
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                      <LockKeyhole className="h-3 w-3" />
                      Protected
                    </span>
                  </div>
                  <input
                    type="password"
                    placeholder="Your password"
                    className="h-12 w-full rounded-2xl border border-white/[0.07] bg-[#15151d] px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-violet-400/35 focus:bg-[#181821]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] px-4 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(109,40,217,0.24)] transition-all hover:translate-y-[-1px] hover:shadow-[0_24px_46px_rgba(109,40,217,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Signing in..." : "Sign In"}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>

                <Link
                  href="/"
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.03] text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white"
                >
                  Go to Website
                </Link>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
