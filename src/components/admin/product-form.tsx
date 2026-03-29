"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import { X, Plus, Ticket, Image as ImageIcon, Layers, DollarSign } from "lucide-react";

interface ProductFormProps {
  initialData?: any;
  isEditing?: boolean;
}

type TabKey = "general" | "media" | "tabs" | "pricing";

interface PriceEntry {
  plan: string;
  price: number;
}

interface FeatureTab {
  title: string;
  description: string;
}

function splitDescriptionAndVideos(raw: string | null | undefined) {
  const full = String(raw || "");
  const marker = "\n\n### Videos\n";
  const markerIndex = full.indexOf(marker);
  if (markerIndex === -1) return { description: full, videos: [] as string[] };

  const description = full.slice(0, markerIndex).trim();
  const trailing = full.slice(markerIndex + marker.length);
  const videos = trailing
    .split("\n")
    .map((line) => line.trim().replace(/^-+\s*/, ""))
    .filter((line) => line.length > 0);
  return { description, videos };
}

const categoryOptions = [
  { value: "VALORANT", label: "Valorant" },
  { value: "CS2", label: "CS2" },
  { value: "SPOOFER", label: "Spoofer" },
  { value: "BYPASS", label: "Bypass" },
  { value: "ROBLOX", label: "Roblox" },
  { value: "OTHER", label: "Other" },
];

const statusOptions = [
  { value: "UNDETECTED", label: "Undetected" },
  { value: "UPDATING", label: "Updating" },
  { value: "MAINTENANCE", label: "Risky" },
  { value: "DETECTED", label: "Detected" },
  { value: "DISCONTINUED", label: "Custom" },
];

const planOptions = [
  { value: "DAILY", label: "1 Day" },
  { value: "3_DAYS", label: "3 Days" },
  { value: "WEEKLY", label: "1 Week" },
  { value: "MONTHLY", label: "1 Month" },
  { value: "3_MONTHS", label: "3 Months" },
  { value: "ONETIME", label: "One Time" },
  { value: "LIFETIME", label: "Lifetime" },
];

const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "TRY", label: "TRY" },
];

const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "general", label: "General", icon: Ticket },
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "tabs", label: "Tabs", icon: Layers },
  { key: "pricing", label: "Pricing", icon: DollarSign },
];

function tabButtonClass(active: boolean) {
  return active
    ? "border-b-2 border-[#c4b3de] text-white"
    : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300";
}

function statusChipClass(value: string, active: boolean) {
  if (!active) return "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.15]";
  if (value === "UNDETECTED") return "border-emerald-400/50 bg-emerald-500/15 text-emerald-300";
  if (value === "UPDATING") return "border-amber-400/50 bg-amber-500/15 text-amber-300";
  if (value === "MAINTENANCE") return "border-orange-400/50 bg-orange-500/15 text-orange-300";
  if (value === "DETECTED") return "border-red-400/50 bg-red-500/15 text-red-300";
  return "border-sky-400/50 bg-sky-500/15 text-sky-300";
}

export function ProductForm({ initialData, isEditing }: ProductFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoSlug, setAutoSlug] = useState(!isEditing);

  const parsedDescription = useMemo(() => splitDescriptionAndVideos(initialData?.description), [initialData?.description]);
  const initialPrices = useMemo<PriceEntry[]>(
    () =>
      Array.isArray(initialData?.prices)
        ? initialData.prices
            .map((p: any) => ({ plan: String(p?.plan || ""), price: Number(p?.price || 0) }))
            .filter((p: PriceEntry) => !!p.plan)
        : [],
    [initialData?.prices]
  );
  const initialBasePrice = initialPrices[0] || { plan: "MONTHLY", price: 0 };
  const initialExtraPrices = initialPrices.slice(1);
  const initialGallery = useMemo(() => (Array.isArray(initialData?.gallery) ? initialData.gallery : []), [initialData?.gallery]);
  const initialThumbnail = initialGallery.find((item: any) => item?.isThumbnail) || initialGallery[0];
  const initialGalleryUrls = initialGallery
    .filter((item: any) => item?.url && item.id !== initialThumbnail?.id)
    .map((item: any) => String(item.url));
  const initialFeatureTabs = useMemo<FeatureTab[]>(
    () =>
      Array.isArray(initialData?.features)
        ? initialData.features.map((item: any) => ({
            title: String(item?.title || "").trim(),
            description: String(item?.description || "").trim(),
          }))
        : [],
    [initialData?.features]
  );

  const [form, setForm] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    shortDescription: initialData?.shortDescription || "",
    description: parsedDescription.description || "",
    category: initialData?.category || "OTHER",
    status: initialData?.status || "UNDETECTED",
    currency: initialData?.currency || "USD",
    buyUrl: initialData?.buyUrl || "",
    accessRoleKey: initialData?.accessRoleKey || "",
    defaultLoaderUrl: initialData?.defaultLoaderUrl || "",
    isActive: initialData?.isActive ?? true,
    isFeatured: initialData?.isFeatured ?? false,
    sortOrder: initialData?.sortOrder ?? 0,
  });

  const [basePlan, setBasePlan] = useState(initialBasePrice.plan || "MONTHLY");
  const [basePrice, setBasePrice] = useState<number>(Number(initialBasePrice.price || 0));
  const [extraPrices, setExtraPrices] = useState<PriceEntry[]>(initialExtraPrices);

  const [mainImageUrl, setMainImageUrl] = useState(String(initialThumbnail?.url || ""));
  const [galleryInput, setGalleryInput] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialGalleryUrls);
  const [videoInput, setVideoInput] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>(parsedDescription.videos);

  const [tabTitle, setTabTitle] = useState("");
  const [tabDescription, setTabDescription] = useState("");
  const [featureTabs, setFeatureTabs] = useState<FeatureTab[]>(initialFeatureTabs);

  const computedSlug = useMemo(() => (autoSlug ? slugify(form.name || "") : form.slug), [form.name, form.slug, autoSlug]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const addExtraPrice = () => {
    const used = new Set([basePlan, ...extraPrices.map((p) => p.plan)]);
    const available = planOptions.find((p) => !used.has(p.value));
    if (!available) return;
    setExtraPrices((prev) => [...prev, { plan: available.value, price: 0 }]);
  };

  const addGalleryUrl = () => {
    const value = galleryInput.trim();
    if (!value) return;
    setGalleryUrls((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setGalleryInput("");
  };

  const addVideoUrl = () => {
    const value = videoInput.trim();
    if (!value) return;
    setVideoUrls((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setVideoInput("");
  };

  const addFeatureTab = () => {
    const title = tabTitle.trim();
    if (!title) return;
    setFeatureTabs((prev) => [...prev, { title, description: tabDescription.trim() }]);
    setTabTitle("");
    setTabDescription("");
  };

  function buildFinalDescription() {
    const base = (form.description || "").trim();
    if (!videoUrls.length) return base;
    const videoBlock = `\n\n### Videos\n${videoUrls.map((url) => `- ${url}`).join("\n")}`;
    return `${base}${videoBlock}`.trim();
  }

  function mapCreateErrorMessage(error: string, code?: string) {
    if (code === "DB_SCHEMA_MISMATCH") {
      return "Database schema is out of date. Run migrations.";
    }
    if (code === "PRODUCT_CREATE_FAILED") {
      return error || "Product could not be created.";
    }
    if (code === "PRODUCT_MEDIA_FAILED") {
      return error || "Product created but media/tabs could not be saved.";
    }
    return error || "Product could not be saved.";
  }

  async function createGallery(productId: string) {
    const queue = [
      ...(mainImageUrl.trim() ? [{ url: mainImageUrl.trim(), isThumbnail: true, order: 0 }] : []),
      ...galleryUrls.map((url, index) => ({ url, isThumbnail: false, order: index + 1 })),
    ];

    await Promise.all(
      queue.map((item) =>
        fetch(`/api/admin/products/${productId}/gallery`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            isThumbnail: item.isThumbnail,
            order: item.order,
            altText: null,
          }),
        })
      )
    );
  }

  async function createFeatureTabs(productId: string) {
    if (!featureTabs.length) return;
    await fetch(`/api/admin/products/${productId}/features`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: featureTabs.map((item, index) => ({
          title: item.title,
          description: item.description || null,
          icon: null,
          order: index,
        })),
      }),
    });
  }

  async function syncGallery(productId: string) {
    const existingRes = await fetch(`/api/admin/products/${productId}/gallery`, { credentials: "include" });
    const existingData = await existingRes.json();
    const existing = Array.isArray(existingData?.data) ? existingData.data : [];

    await Promise.all(
      existing.map((item: any) =>
        fetch(`/api/admin/products/${productId}/gallery`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId: item.id }),
        })
      )
    );

    await createGallery(productId);
  }

  async function syncFeatureTabs(productId: string) {
    const existingRes = await fetch(`/api/admin/products/${productId}/features`, { credentials: "include" });
    const existingData = await existingRes.json();
    const existing = Array.isArray(existingData?.data) ? existingData.data : [];

    await Promise.all(
      existing.map((item: any) =>
        fetch(`/api/admin/products/${productId}/features`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureId: item.id }),
        })
      )
    );

    await createFeatureTabs(productId);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrors({});

    const mergedPrices: PriceEntry[] = [{ plan: basePlan, price: Number(basePrice) }, ...extraPrices.map((p) => ({ ...p, price: Number(p.price) }))];
    const uniquePrices = mergedPrices
      .filter((item) => item.plan && Number.isFinite(item.price))
      .filter((item, index, list) => list.findIndex((x) => x.plan === item.plan) === index);

    const payload = {
      ...form,
      slug: computedSlug,
      description: buildFinalDescription(),
      sortOrder: Number(form.sortOrder || 0),
      displayOrder: Number(form.sortOrder || 0),
      prices: uniquePrices,
      features: [],
    };

    try {
      const url = isEditing ? `/api/admin/products/${initialData.id}` : "/api/admin/products";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        addToast({
          type: "error",
          title: "Error",
          description: mapCreateErrorMessage(data?.error, data?.code),
        });
        setLoading(false);
        return;
      }

      const productId = data?.data?.id || initialData?.id;
      if (productId) {
        let mediaFailed = false;
        try {
          if (isEditing) await syncGallery(productId);
          else await createGallery(productId);
        } catch (mediaError) {
          console.error("Product gallery creation failed:", mediaError);
          mediaFailed = true;
        }
        try {
          if (isEditing) await syncFeatureTabs(productId);
          else await createFeatureTabs(productId);
        } catch (featureError) {
          console.error("Product feature tabs creation failed:", featureError);
          mediaFailed = true;
        }

        if (mediaFailed) {
          addToast({
            type: "error",
            title: "Partial Success",
            description: mapCreateErrorMessage(
              "Product created but media/tabs could not be saved.",
              "PRODUCT_MEDIA_FAILED"
            ),
          });
          router.push("/admin/products");
          router.refresh();
          return;
        }
      }

      addToast({
        type: "success",
        title: isEditing ? "Updated" : "Created",
        description: `${payload.name} saved successfully.`,
      });
      router.push("/admin/products");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "Error", description: "Unexpected error while saving product." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(22,22,30,0.96),rgba(12,12,17,0.98))] shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">{isEditing ? "Edit Product" : "New Product"}</h2>
        </div>

        <div className="flex gap-4 border-b border-white/[0.06] px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-2 py-3 text-sm font-medium transition ${tabButtonClass(activeTab === tab.key)}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[430px] px-6 py-5">
          {activeTab === "general" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Product Name *</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="Apex Legends Aimbot"
                />
                {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Game *</label>
                  <select
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Base Price ({form.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={basePrice}
                    onChange={(event) => setBasePrice(Number(event.target.value))}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                    placeholder="14.99"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Slug *</label>
                  <input
                    value={computedSlug}
                    onChange={(event) => {
                      setAutoSlug(false);
                      updateField("slug", event.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="mt-7 inline-flex items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" checked={autoSlug} onChange={(event) => setAutoSlug(event.target.checked)} />
                  Auto slug
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Product Role Key</label>
                <input
                  value={form.accessRoleKey}
                  onChange={(event) => updateField("accessRoleKey", event.target.value.toUpperCase())}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="ROLE_PRODUCT_APEX"
                />
                <p className="text-xs text-zinc-500">Assigned to users automatically when they purchase this product.</p>
                {errors.accessRoleKey && <p className="text-xs text-red-400">{errors.accessRoleKey}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="min-h-[110px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="Product description..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Status</label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField("status", option.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${statusChipClass(option.value, form.status === option.value)}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Main Image (Cover)</label>
                <input
                  value={mainImageUrl}
                  onChange={(event) => setMainImageUrl(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Gallery Images</label>
                <div className="flex gap-2">
                  <input
                    value={galleryInput}
                    onChange={(event) => setGalleryInput(event.target.value)}
                    className="h-11 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                    placeholder="https://..."
                  />
                  <button type="button" onClick={addGalleryUrl} className="rounded-xl border border-[#c4b3de]/35 bg-[#b6a4d2]/15 px-4 text-sm font-medium text-[#ded4ec]">
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {galleryUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                      <span className="truncate">{url}</span>
                      <button type="button" onClick={() => setGalleryUrls((prev) => prev.filter((_, i) => i !== index))} className="text-zinc-500 hover:text-zinc-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Videos (Youtube / Streamable)</label>
                <div className="flex gap-2">
                  <input
                    value={videoInput}
                    onChange={(event) => setVideoInput(event.target.value)}
                    className="h-11 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  <button type="button" onClick={addVideoUrl} className="rounded-xl border border-[#c4b3de]/35 bg-[#b6a4d2]/15 px-4 text-sm font-medium text-[#ded4ec]">
                    Add
                  </button>
                </div>
                {videoUrls.length > 0 && (
                  <p className="text-xs text-zinc-500">{videoUrls.length} video link will be appended into description.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "tabs" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Feature Tabs</label>
                <p className="text-xs text-zinc-500">e.g. Visuals, Aimbot, Miscellaneous</p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={tabTitle}
                  onChange={(event) => setTabTitle(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="Tab title"
                />
                <input
                  value={tabDescription}
                  onChange={(event) => setTabDescription(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="Tab description"
                />
                <button type="button" onClick={addFeatureTab} className="rounded-xl border border-[#c4b3de]/35 bg-[#b6a4d2]/15 px-4 text-sm font-medium text-[#ded4ec]">
                  <Plus className="mr-1 inline h-4 w-4" />
                  Tab Add
                </button>
              </div>

              <div className="space-y-2">
                {featureTabs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.1] py-14 text-center text-zinc-500">No tabs added yet</div>
                ) : (
                  featureTabs.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                        {item.description && <p className="text-xs text-zinc-500">{item.description}</p>}
                      </div>
                      <button type="button" onClick={() => setFeatureTabs((prev) => prev.filter((_, i) => i !== index))} className="text-zinc-500 hover:text-zinc-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Pricing Plans</label>
                <p className="text-xs text-zinc-500">You can use standard plans or custom labels like game names.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                <input
                  value={basePlan}
                  onChange={(event) => setBasePlan(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="MONTHLY or Fortnite"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(event) => setBasePrice(Number(event.target.value))}
                  className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                {extraPrices.map((price, index) => (
                  <div key={`extra-price-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
                    <input
                      value={price.plan}
                      onChange={(event) =>
                        setExtraPrices((prev) => prev.map((item, i) => (i === index ? { ...item, plan: event.target.value } : item)))
                      }
                      className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none"
                      placeholder="WEEKLY or Rust"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.price}
                      onChange={(event) =>
                        setExtraPrices((prev) => prev.map((item, i) => (i === index ? { ...item, price: Number(event.target.value) } : item)))
                      }
                      className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraPrices((prev) => prev.filter((_, i) => i !== index))}
                      className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addExtraPrice} className="rounded-xl border border-[#c4b3de]/35 bg-[#b6a4d2]/15 px-4 py-2 text-sm font-medium text-[#ded4ec]">
                  <Plus className="mr-1 inline h-4 w-4" />
                  Plan Add
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Loader Download URL</label>
                <input
                  value={form.defaultLoaderUrl}
                  onChange={(event) => updateField("defaultLoaderUrl", event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-100 outline-none focus:border-[#c4b3de]/40"
                  placeholder="https://example.com/loader.exe"
                />
                {errors.defaultLoaderUrl && <p className="text-xs text-red-400">{errors.defaultLoaderUrl}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border border-[#c4b3de]/40 bg-[#b6a4d2]/20 px-5 py-2.5 text-sm font-semibold text-[#ede7f8] hover:bg-[#b6a4d2]/28 disabled:opacity-60"
          >
            {loading ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </form>
  );
}
