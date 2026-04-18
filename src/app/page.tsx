import Link from "next/link";
import { FAQSection } from "@/components/marketing/faq-section";

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#101114_0%,#14161a_50%,#101114_100%)] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Lity Software</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Premium software marketplace</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Manage purchases, licenses and updates from one place with a compact, dark, modern dashboard experience.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/products"
              className="inline-flex h-9 items-center rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 text-sm font-medium text-violet-100 hover:bg-violet-500/15"
            >
              Browse Products
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]"
            >
              Open Dashboard
            </Link>
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]"
            >
              Admin Panel
            </Link>
          </div>
        </section>

        <FAQSection />
      </div>
    </main>
  );
}
