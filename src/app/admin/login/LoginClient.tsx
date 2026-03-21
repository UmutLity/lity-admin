"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, AlertCircle, ArrowRight, Clock, Sparkles, LockKeyhole } from "lucide-react";

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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(113,113,122,0.14),transparent_16%),linear-gradient(180deg,#0b0b11,#13131a)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden rounded-[32px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(25,24,35,0.84),rgba(17,17,24,0.72))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                Secure Control Surface
              </div>
              <h1 className="mt-6 max-w-md text-4xl font-semibold tracking-tight text-white">
                Lity Admin ile urunleri, durumlari ve ekibi tek yerden yonetin.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400">
                Soft mor ve koyu gri arayuz ile daha sakin, daha premium bir operasyon paneli.
                Giris yaptiktan sonra urunler, changeloglar ve medya akisi ayni tasarim dilinde devam eder.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: "Products", text: "Pricing, features and status control" },
                { title: "Security", text: "Role and session aware access flow" },
                { title: "Updates", text: "Changelog and media operations" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-[430px] rounded-[32px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(23,23,31,0.96),rgba(15,15,22,0.96))] p-7 shadow-[0_34px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] shadow-[0_16px_34px_rgba(109,40,217,0.28)]">
                    <Shield className="h-5 w-5 text-white" />
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
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
