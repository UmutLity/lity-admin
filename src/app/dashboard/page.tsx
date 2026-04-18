"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LicenseCard } from "@/components/customer/dashboard/license-card";
import { RecommendedProducts } from "@/components/customer/dashboard/recommended-products";
import { CustomerLicense, RecommendedProduct } from "@/types/customer-dashboard";

type LicenseApiItem = {
  id: string;
  key: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
  downloadUrl: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  };
};

type ProductApiItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  prices?: Array<{ price: number }>;
  images?: Array<{ media?: { url?: string | null } | null }>;
};

export default function CustomerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState<CustomerLicense[]>([]);
  const [ownedProductIds, setOwnedProductIds] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [licensesRes, productsRes] = await Promise.all([
          fetch("/api/auth/customer/licenses", { credentials: "include" }),
          fetch("/api/products", { credentials: "include" }),
        ]);

        const licensesJson = await licensesRes.json();
        const productsJson = await productsRes.json();

        if (!licensesRes.ok || !licensesJson?.success) {
          throw new Error(licensesJson?.error || "Could not load licenses");
        }
        if (!productsRes.ok || !productsJson?.success) {
          throw new Error(productsJson?.error || "Could not load products");
        }

        const licenseRows: LicenseApiItem[] = Array.isArray(licensesJson.data) ? licensesJson.data : [];
        const productRows: ProductApiItem[] = Array.isArray(productsJson.data) ? productsJson.data : [];

        const mappedLicenses: CustomerLicense[] = licenseRows.map((item) => ({
          id: item.id,
          productName: item.product?.name || "Product",
          productSlug: item.product?.slug || "",
          licenseKey: item.key,
          status: item.status,
          expiresAt: item.expiresAt,
          downloadUrl: item.downloadUrl,
        }));

        const owned = licenseRows.map((item) => item.product?.id).filter(Boolean) as string[];

        const mappedProducts: RecommendedProduct[] = productRows.map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          shortDescription: item.shortDescription || null,
          imageUrl: item.images?.[0]?.media?.url || null,
          price: Number(item.prices?.[0]?.price || 0),
        }));

        if (!mounted) return;
        setLicenses(mappedLicenses);
        setOwnedProductIds(owned);
        setRecommended(mappedProducts);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Dashboard data could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = useMemo(() => licenses.filter((item) => item.status === "ACTIVE").length, [licenses]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#101114_0%,#14161a_50%,#101114_100%)] px-6 py-6">
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-zinc-100">User Dashboard</h1>
              <p className="mt-1 text-xs text-zinc-500">Manage your licenses and downloads</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <span className="text-xs text-zinc-500">Active licenses</span>
              <span className="text-sm font-semibold text-emerald-300">{activeCount}</span>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-xs text-red-200">{error}</div>
        ) : null}

        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-zinc-100">My licenses</h2>
            <p className="mt-1 text-xs text-zinc-500">Compact view of your purchased products</p>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-40 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />
              ))}
            </div>
          ) : licenses.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-zinc-500">
              You don&apos;t have any licenses yet.{" "}
              <Link href="/products" className="text-violet-200 hover:text-violet-100">
                Browse products
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {licenses.map((license) => (
                <LicenseCard key={license.id} license={license} />
              ))}
            </div>
          )}
        </section>

        <RecommendedProducts products={recommended} ownedProductIds={ownedProductIds} />
      </div>
    </main>
  );
}

