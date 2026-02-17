"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, AlertCircle, ArrowRight, Clock } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-[#080d19] p-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-white text-xl font-bold mb-6 text-center">
          Lity Admin
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {idleWarning && (
            <div className="text-amber-400 text-xs">
              Session expired due to inactivity.
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-black/40 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 rounded bg-black/40 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full p-2 bg-purple-600 rounded text-white"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
