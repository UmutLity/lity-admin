"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Layers3, Rocket, Shield, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type PriceData = { id: string; plan: string; price: number };
type FeatureData = { id: string; title: string; description: string };
type SpecificationData = { id: string; label: string; value: string };
type GalleryData = { id: string; url: string; altText: string; isThumbnail: boolean };
type ChangelogData = { id: string; title: string; body: string; type: string; publishedAt: string | null };

export type ProductDetailData = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  shortDescription: string;
  description: string;
  longDescription: string;
  technicalDescription: string;
  currency: string;
  updatedAt: string;
  prices: PriceData[];
  features: FeatureData[];
  specifications: SpecificationData[];
  gallery: GalleryData[];
  changelog: ChangelogData[];
};

export type RelatedProductData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  status: string;
  fromPrice: number;
  imageUrl: string | null;
  currency: string;
};

function planLabel(plan: string) {
  return plan.split("_").join(" ");
}

function statusVariant(status: string): "success" | "warning" | "error" | "default" {
  const key = status.toUpperCase();
  if (key === "UNDETECTED") return "success";
  if (key === "UPDATING" || key === "MAINTENANCE") return "warning";
  if (key === "DETECTED" || key === "DISCONTINUED") return "error";
  return "default";
}

function buildFaq(product: ProductDetailData) {
  const base = [
    {
      q: "How fast do I get access?",
      a: "License access is typically delivered instantly after successful checkout.",
    },
    {
      q: "Can I switch plans later?",
      a: "Yes. You can purchase another plan anytime and keep both licenses active independently.",
    },
  ];

  const fromSpecs = product.specifications.slice(0, 2).map((item) => ({
    q: `${item.label} details`,
    a: item.value,
  }));

  return [...base, ...fromSpecs];
}

function formatPlanDisplay(plan: string) {
  return planLabel(plan)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ProductDetailView({ product, relatedProducts }: { product: ProductDetailData; relatedProducts: RelatedProductData[] }) {
  const hasRealGallery = product.gallery.length > 0;
  const gallery = hasRealGallery
    ? product.gallery
    : [{ id: "fallback", url: "/litysoftware.png", altText: `${product.name} preview`, isThumbnail: true }];
  const thumbnail = gallery.find((item) => item.isThumbnail) || gallery[0];
  const [activeImage, setActiveImage] = useState(thumbnail.url);
  const [selectedPlan, setSelectedPlan] = useState(product.prices[0]?.plan ?? "");

  const selectedPrice = useMemo(
    () => product.prices.find((item) => item.plan === selectedPlan) ?? product.prices[0] ?? null,
    [product.prices, selectedPlan]
  );

  const faq = useMemo(() => buildFaq(product), [product]);
  const spotlightPlans = product.prices.slice(0, 4);
  const summary = product.shortDescription || product.description || "Premium access with fast delivery and game-based pricing.";
  const relatedItems = relatedProducts.slice(0, 3);

  return (
    <main className="page-enter relative mx-auto w-full max-w-[1480px] space-y-6 overflow-hidden p-5 lg:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent)]" />
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="premium-card overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
              <Badge variant="outline">{product.category}</Badge>
              <Badge variant="default" className="bg-primary/18 text-primary">Updated {formatDate(product.updatedAt)}</Badge>
            </div>
            <div>
              <CardTitle className="text-3xl font-semibold leading-tight md:text-4xl">{product.name}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-base text-zinc-300">
                {product.shortDescription || product.description || "Premium product with stable delivery and clean performance."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Selected Price</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {selectedPrice ? formatCurrency(selectedPrice.price, product.currency) : "Contact"}
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Plan</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="mt-2 flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-[rgba(16,16,22,0.96)] px-3 text-sm text-zinc-100 transition hover:border-primary/35 hover:bg-[rgba(20,20,28,0.98)]"
                    >
                      <span className="truncate">
                        {selectedPrice
                          ? `${formatPlanDisplay(selectedPrice.plan)} - ${formatCurrency(selectedPrice.price, product.currency)}`
                          : "Select plan"}
                      </span>
                      <span className="ml-3 text-zinc-500">v</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px] rounded-xl border border-white/10 bg-[rgba(16,16,22,0.98)] p-1.5 text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                  >
                    {product.prices.map((price) => {
                      const active = price.plan === selectedPlan;
                      return (
                        <DropdownMenuItem
                          key={price.id}
                          onSelect={() => setSelectedPlan(price.plan)}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:bg-[rgba(124,58,237,0.16)] focus:text-white",
                            active && "bg-[rgba(124,58,237,0.18)] text-white"
                          )}
                        >
                          <span>{formatPlanDisplay(price.plan)}</span>
                          <span className="font-semibold text-primary">{formatCurrency(price.price, product.currency)}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(116,83,211,0.22),rgba(255,255,255,0.03))] p-5">
              <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
              <div className="relative grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-zinc-300">
                    <Layers3 className="h-3.5 w-3.5 text-primary" />
                    Product Spotlight
                  </div>
                  <h3 className="max-w-xl text-2xl font-semibold text-zinc-50 md:text-3xl">{product.name}</h3>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-300">{summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {spotlightPlans.map((price) => (
                      <span key={price.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-200">
                        {formatPlanDisplay(price.plan)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Pricing Model</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-100">Game-based selection</p>
                    <p className="mt-1 text-sm text-zinc-400">Choose a title-specific option from the pricing card.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Delivery</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-100">Instant after checkout</p>
                    <p className="mt-1 text-sm text-zinc-400">Purchase, receive access, and continue without delay.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/85">
                Buy {selectedPrice ? planLabel(selectedPrice.plan) : "Now"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#plans">Compare Plans</a>
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-muted/20 px-3 py-2 text-sm text-zinc-300">
                <Shield className="mb-1 h-4 w-4 text-primary" />
                Secure checkout
              </div>
              <div className="rounded-lg border border-white/10 bg-muted/20 px-3 py-2 text-sm text-zinc-300">
                <Clock3 className="mb-1 h-4 w-4 text-primary" />
                Instant delivery
              </div>
              <div className="rounded-lg border border-white/10 bg-muted/20 px-3 py-2 text-sm text-zinc-300">
                <Rocket className="mb-1 h-4 w-4 text-primary" />
                Fast activation
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{hasRealGallery ? "Product Preview" : "Product Overview"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasRealGallery ? (
              <>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeImage} alt={product.name} className="h-[260px] w-full object-cover" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {gallery.slice(0, 4).map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveImage(image.url)}
                      className={cn(
                        "overflow-hidden rounded-lg border bg-black/20 transition",
                        activeImage === image.url ? "border-primary/70 ring-1 ring-primary/40" : "border-white/10 hover:border-primary/35"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.altText} className="h-16 w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(24,24,27,0.92),rgba(94,48,182,0.22))] p-5">
                <div className="pointer-events-none absolute left-0 top-0 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{product.category}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Selection Range</p>
                    <div className="mt-4 grid gap-2">
                      {spotlightPlans.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                          <span className="text-sm text-zinc-200">{formatPlanDisplay(item.plan)}</span>
                          <span className="text-sm font-semibold text-primary">{formatCurrency(item.price, product.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-zinc-300">
                    This product uses flexible title-based pricing, so the experience is centered around selection rather than screenshots.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Undetected Rate", value: "99.9%", icon: Shield },
          { label: "Delivery", value: "Instant", icon: Rocket },
          { label: "Support", value: "24/7", icon: Sparkles },
          { label: "Uptime", value: "99.95%", icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label} className="kpi-card border-white/8">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-zinc-100">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {product.features.length ? (
          product.features.map((feature) => (
            <Card key={feature.id} className="premium-card border-white/8">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{feature.description || "Detailed feature information will appear here."}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="premium-card border-white/8 md:col-span-2 xl:col-span-3">
            <CardContent className="p-5 text-sm text-zinc-400">
              Feature list is being prepared. This product uses the same premium delivery and update standards.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="premium-card rounded-2xl border border-white/8 p-4 md:p-6">
        <Tabs defaultValue="features" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto bg-muted/70">
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="changelog">Changelog</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>

          <TabsContent value="features">
            <Card className="mt-3 border-white/8 bg-muted/20">
              <CardContent className="space-y-2 p-4">
                {(product.features.length ? product.features : [{ id: "default", title: "Stable Core", description: product.description }]).map((item) => (
                  <div key={item.id} className="flex items-start gap-2 rounded-lg border border-white/8 bg-muted/20 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-sm text-zinc-400">{item.description || "Premium implementation details."}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements">
            <Card className="mt-3 border-white/8 bg-muted/20">
              <CardContent className="space-y-2 p-4">
                {(product.specifications.length ? product.specifications : [{ id: "r", label: "Environment", value: "Windows 10/11 64-bit" }]).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-muted/20 px-3 py-2">
                    <span className="text-sm text-zinc-400">{item.label}</span>
                    <span className="text-sm font-medium text-zinc-100">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="changelog">
            <Card className="mt-3 border-white/8 bg-muted/20">
              <CardContent className="space-y-3 p-4">
                {(product.changelog.length ? product.changelog : [{ id: "none", title: "Initial Release", body: "No changelog published yet.", type: "INFO", publishedAt: null }]).map((log) => (
                  <div key={log.id} className="rounded-lg border border-white/8 bg-muted/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline">{log.type}</Badge>
                      <span className="text-xs text-zinc-500">{log.publishedAt ? formatDate(log.publishedAt) : "Pending"}</span>
                    </div>
                    <p className="font-medium">{log.title}</p>
                    <p className="mt-1 text-sm text-zinc-400">{log.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq">
            <Card className="mt-3 border-white/8 bg-muted/20">
              <CardContent className="space-y-2 p-4">
                {faq.map((item) => (
                  <details key={item.q} className="group rounded-lg border border-white/8 bg-muted/20 p-3">
                    <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">{item.q}</summary>
                    <p className="mt-2 text-sm text-zinc-400">{item.a}</p>
                  </details>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {hasRealGallery && (
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold">Preview Gallery</h2>
            <p className="text-sm text-zinc-400">Visual previews from the latest build.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gallery.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImage(image.url)}
                className={cn(
                  "overflow-hidden rounded-xl border bg-background/40 text-left transition",
                  activeImage === image.url ? "border-primary/60 ring-1 ring-primary/30" : "border-white/10 hover:border-primary/35"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.altText} className="h-44 w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="plans" className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Pricing & Plan Comparison</h2>
          <p className="text-sm text-zinc-400">Choose the plan that matches your usage and budget.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {product.prices.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "premium-card border-white/8",
                selectedPrice?.id === item.id && "border-primary/45 shadow-[0_0_0_1px_rgba(169,150,196,0.2)]"
              )}
            >
              <CardHeader>
                <CardTitle className="text-lg">{planLabel(item.plan)}</CardTitle>
                <CardDescription>{formatCurrency(item.price, product.currency)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant={selectedPrice?.id === item.id ? "default" : "outline"}
                  onClick={() => setSelectedPlan(item.plan)}
                >
                  Select Plan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {relatedItems.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold">Related Products</h2>
            <p className="text-sm text-zinc-400">Explore similar products in the same category.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {relatedItems.map((item) => (
              <Card key={item.id} className="premium-card border-white/8">
                <CardContent className="space-y-3 p-4">
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl || "/litysoftware.png"} alt={item.name} className="h-36 w-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    </div>
                    <p className="text-sm text-zinc-400">{item.shortDescription}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-primary">From {formatCurrency(item.fromPrice, item.currency)}</p>
                    <Button variant="outline" asChild>
                      <Link href={`/products/${item.slug}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-primary/25 bg-primary/10 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Ready to get started with {product.name}?</h3>
            <p className="mt-1 text-sm text-zinc-300">Launch instantly with the same soft-purple premium experience.</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/85">
              Purchase Now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Star className="h-4 w-4" />
              Read Reviews
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
