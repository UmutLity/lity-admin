"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import { X, Plus, Ticket, Image as ImageIcon, Layers, DollarSign, Upload, Loader2 } from "lucide-react";

interface ProductFormProps {
  initialData?: any;
  isEditing?: boolean;
}

type TabKey = "general" | "media" | "tabs" | "pricing";

interface PriceEntry {
  plan: string;
  price: number;
  customLabel?: string;
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
const CUSTOM_PLAN_VALUE = "__CUSTOM__";

const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "TRY", label: "TRY" },
];

const stockStatusOptions = [
  { value: "IN_STOCK", label: "In Stock" },
  { value: "LOW_STOCK", label: "Low Stock" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
];

const deliveryTypeOptions = [
  { value: "MANUAL", label: "Manual Delivery" },
  { value: "INSTANT", label: "Instant Delivery" },
  { value: "SCHEDULED", label: "Scheduled Delivery" },
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

function getPlanLabel(value: string, customLabel?: string) {
  if (value === CUSTOM_PLAN_VALUE) return customLabel?.trim() || "Custom";
  return planOptions.find((item) => item.value === value)?.label || value;
}

const labelClass = "admin-label";
const fieldClass = "admin-input";
const selectClass = "admin-select";
const textareaClass = "admin-textarea";
const primaryButtonClass = "admin-btn-primary px-4 py-2";
const secondaryButtonClass = "admin-btn-secondary px-5 py-2.5";

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
            .map((p: any) => {
              const rawPlan = String(p?.plan || "");
              const isStandard = planOptions.some((item) => item.value === rawPlan);
              return {
                plan: isStandard ? rawPlan : CUSTOM_PLAN_VALUE,
                customLabel: isStandard ? "" : rawPlan,
                price: Number(p?.price || 0),
              };
            })
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
    defaultLoaderUrl: initialData?.defaultLoaderUrl || "",
    stockStatus: initialData?.stockStatus || "IN_STOCK",
    deliveryType: initialData?.deliveryType || "MANUAL",
    estimatedDelivery: initialData?.estimatedDelivery || "",
    isActive: initialData?.isActive ?? true,
    isFeatured: initialData?.isFeatured ?? false,
    sortOrder: initialData?.sortOrder ?? 0,
  });

  const [basePlan, setBasePlan] = useState(initialBasePrice.plan || "MONTHLY");
  const [baseCustomPlan, setBaseCustomPlan] = useState(initialBasePrice.customLabel || "");
  const [basePrice, setBasePrice] = useState<number>(Number(initialBasePrice.price || 0));
  const [extraPrices, setExtraPrices] = useState<PriceEntry[]>(initialExtraPrices);

  const [mainImageUrl, setMainImageUrl] = useState(String(initialThumbnail?.url || ""));
  const [galleryInput, setGalleryInput] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialGalleryUrls);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [uploadingGalleryFiles, setUploadingGalleryFiles] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>(parsedDescription.videos);

  const [tabTitle, setTabTitle] = useState("");
  const [tabDescription, setTabDescription] = useState("");
  const [bulkFeatureInput, setBulkFeatureInput] = useState("");
  const [featureTabs, setFeatureTabs] = useState<FeatureTab[]>(initialFeatureTabs);

  const computedSlug = useMemo(() => (autoSlug ? slugify(form.name || "") : form.slug), [form.name, form.slug, autoSlug]);
  const previewPriceLabel = `${form.currency} ${Number(basePrice || 0).toFixed(2)}`;
  const previewPlanLabel = getPlanLabel(basePlan, baseCustomPlan);
  const previewStatusLabel = statusOptions.find((item) => item.value === form.status)?.label || "Status";
  const previewImage = mainImageUrl.trim();

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const addExtraPrice = () => {
    const used = new Set([
      basePlan === CUSTOM_PLAN_VALUE ? null : basePlan,
      ...extraPrices.map((p) => (p.plan === CUSTOM_PLAN_VALUE ? null : p.plan)),
    ]);
    const available = planOptions.find((p) => !used.has(p.value));
    setExtraPrices((prev) => [...prev, { plan: available?.value || CUSTOM_PLAN_VALUE, customLabel: "", price: 0 }]);
  };

  const addGalleryUrl = () => {
    const value = galleryInput.trim();
    if (!value) return;
    setGalleryUrls((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setGalleryInput("");
  };

  const onGalleryFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const onlyImages = files.filter((file) => file.type.startsWith("image/"));
    if (!onlyImages.length) {
      addToast({
        type: "error",
        title: "Invalid File",
        description: "Please select image files only.",
      });
      return;
    }
    setGalleryFiles((prev) => {
      const dedupe = new Map<string, File>();
      [...prev, ...onlyImages].forEach((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        dedupe.set(key, file);
      });
      return Array.from(dedupe.values());
    });
    event.target.value = "";
  };

  const removeGalleryFile = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadGalleryFiles = async () => {
    if (!galleryFiles.length) return;
    setUploadingGalleryFiles(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of galleryFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/media", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await response.json();

        if (!response.ok || !data?.success || !data?.data?.url) {
          throw new Error(data?.error || `Upload failed for ${file.name}`);
        }

        uploadedUrls.push(String(data.data.url));
      }

      if (uploadedUrls.length > 0) {
        if (!String(mainImageUrl || "").trim()) {
          setMainImageUrl(uploadedUrls[0]);
        }
        setGalleryUrls((prev) => {
          const existing = new Set(prev.map((url) => String(url).trim()).filter(Boolean));
          const next = [...prev];
          uploadedUrls.forEach((url) => {
            if (existing.has(url)) return;
            existing.add(url);
            next.push(url);
          });
          return next;
        });
      }

      setGalleryFiles([]);
      addToast({
        type: "success",
        title: "Uploaded",
        description: `${uploadedUrls.length} image${uploadedUrls.length > 1 ? "s" : ""} uploaded and added to gallery.`,
      });
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Upload Failed",
        description: error?.message || "Images could not be uploaded.",
      });
    } finally {
      setUploadingGalleryFiles(false);
    }
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

  const addBulkFeatureTabs = () => {
    const lines = bulkFeatureInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return;

    const parsed = lines
      .map((line) => {
        const [rawTitle, ...rest] = line.split("|");
        const title = String(rawTitle || "").trim();
        const description = rest.join("|").trim();
        return {
          title,
          description,
        };
      })
      .filter((item) => item.title.length > 0);

    if (!parsed.length) return;

    setFeatureTabs((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.title.toLowerCase()}::${item.description.toLowerCase()}`));
      const next = [...prev];

      parsed.forEach((item) => {
        const key = `${item.title.toLowerCase()}::${item.description.toLowerCase()}`;
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        next.push(item);
      });

      return next;
    });

    setBulkFeatureInput("");
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

    const mergedPrices: PriceEntry[] = [
      { plan: basePlan, customLabel: baseCustomPlan, price: Number(basePrice) },
      ...extraPrices.map((p) => ({ ...p, price: Number(p.price) })),
    ];
    const uniquePrices = mergedPrices
      .map((item) => ({
        plan: item.plan === CUSTOM_PLAN_VALUE ? String(item.customLabel || "").trim() : item.plan,
        price: Number(item.price),
      }))
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                <label className={labelClass}>Product Name *</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClass}
                  placeholder="Apex Legends Aimbot"
                />
                {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Game *</label>
                  <select
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className={selectClass}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Base Price ({form.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={basePrice}
                    onChange={(event) => setBasePrice(Number(event.target.value))}
                    className={fieldClass}
                    placeholder="14.99"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className={labelClass}>Slug *</label>
                  <input
                    value={computedSlug}
                    onChange={(event) => {
                      setAutoSlug(false);
                      updateField("slug", event.target.value);
                    }}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Currency</label>
                  <select
                    value={form.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                    className={selectClass}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className={labelClass}>Stock Status</label>
                  <select
                    value={form.stockStatus}
                    onChange={(event) => updateField("stockStatus", event.target.value)}
                    className={selectClass}
                  >
                    {stockStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Delivery Type</label>
                  <select
                    value={form.deliveryType}
                    onChange={(event) => updateField("deliveryType", event.target.value)}
                    className={selectClass}
                  >
                    {deliveryTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Estimated Delivery</label>
                  <input
                    value={form.estimatedDelivery}
                    onChange={(event) => updateField("estimatedDelivery", event.target.value)}
                    className={fieldClass}
                    placeholder="5-30 min / 1-6 hours / instant"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className={textareaClass}
                  placeholder="Product description..."
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Status</label>
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

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={!!form.isFeatured}
                    onChange={(event) => updateField("isFeatured", event.target.checked)}
                  />
                  Set as featured product
                </label>
                <p className="mt-1 text-xs text-zinc-500">
                  Only one product can be featured. Enabling this will automatically remove featured status from others.
                </p>
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className={labelClass}>Upload Images (Multiple)</label>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onGalleryFilesSelected}
                      className="block w-full cursor-pointer text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border file:border-white/[0.1] file:bg-white/[0.06] file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-white/[0.1]"
                    />
                    <button
                      type="button"
                      onClick={uploadGalleryFiles}
                      disabled={!galleryFiles.length || uploadingGalleryFiles}
                      className={`${primaryButtonClass} whitespace-nowrap disabled:opacity-60`}
                    >
                      {uploadingGalleryFiles ? (
                        <>
                          <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-1 inline h-4 w-4" />
                          Upload Selected
                        </>
                      )}
                    </button>
                  </div>

                  {galleryFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {galleryFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300"
                        >
                          <span className="truncate">
                            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeGalleryFile(index)}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  Uploaded images are automatically added to the product gallery slider.
                </p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Main Thumbnail / Cover Image</label>
                <input
                  value={mainImageUrl}
                  onChange={(event) => setMainImageUrl(event.target.value)}
                  className={fieldClass}
                  placeholder="https://..."
                />
                <p className="text-xs text-zinc-500">This image is used as the thumbnail in product cards and as the main cover on the product page.</p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Gallery Images</label>
                <div className="flex gap-2">
                  <input
                    value={galleryInput}
                    onChange={(event) => setGalleryInput(event.target.value)}
                    className={`${fieldClass} flex-1`}
                    placeholder="https://..."
                  />
                  <button type="button" onClick={addGalleryUrl} className={primaryButtonClass}>
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
                <label className={labelClass}>Videos (Youtube / Streamable)</label>
                <div className="flex gap-2">
                  <input
                    value={videoInput}
                    onChange={(event) => setVideoInput(event.target.value)}
                    className={`${fieldClass} flex-1`}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  <button type="button" onClick={addVideoUrl} className={primaryButtonClass}>
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
                <label className={labelClass}>Feature Tabs</label>
                <p className="text-xs text-zinc-500">e.g. Visuals, Aimbot, Miscellaneous</p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={tabTitle}
                  onChange={(event) => setTabTitle(event.target.value)}
                  className={fieldClass}
                  placeholder="Tab title"
                />
                <input
                  value={tabDescription}
                  onChange={(event) => setTabDescription(event.target.value)}
                  className={fieldClass}
                  placeholder="Tab description"
                />
                <button type="button" onClick={addFeatureTab} className={primaryButtonClass}>
                  <Plus className="mr-1 inline h-4 w-4" />
                  Tab Add
                </button>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="mb-3 space-y-1">
                  <label className="text-sm font-medium text-zinc-200">Bulk Add</label>
                  <p className="text-xs text-zinc-500">Use one line per tab. Format: <span className="text-zinc-300">Title | Description</span></p>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={bulkFeatureInput}
                    onChange={(event) => setBulkFeatureInput(event.target.value)}
                    className={textareaClass}
                    placeholder={`Visuals | ESP settings, colors and visibility options\nAimbot | Smoothness, FOV and targeting behavior\nMisc | Triggerbot, radar and utility tools`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-zinc-500">Duplicate rows are ignored automatically.</p>
                    <button type="button" onClick={addBulkFeatureTabs} className={primaryButtonClass}>
                      <Plus className="mr-1 inline h-4 w-4" />
                      Bulk Add
                    </button>
                  </div>
                </div>
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
                <label className={labelClass}>Pricing Plans</label>
                <p className="text-xs text-zinc-500">Standard options stay available. Choose Custom for game-based pricing.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                <select
                  value={basePlan}
                  onChange={(event) => setBasePlan(event.target.value)}
                  className={selectClass}
                >
                  {planOptions.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                  <option value={CUSTOM_PLAN_VALUE}>Custom</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(event) => setBasePrice(Number(event.target.value))}
                  className={fieldClass}
                  placeholder="0.00"
                />
              </div>
              {basePlan === CUSTOM_PLAN_VALUE && (
                <input
                  value={baseCustomPlan}
                  onChange={(event) => setBaseCustomPlan(event.target.value)}
                  className={fieldClass}
                  placeholder="Game name, e.g. Escape From Tarkov"
                />
              )}

              <div className="space-y-2">
                {extraPrices.map((price, index) => (
                  <div key={`extra-price-${index}`} className={`grid grid-cols-1 gap-2 ${price.plan === CUSTOM_PLAN_VALUE ? "md:grid-cols-[180px_1fr_1fr_auto]" : "md:grid-cols-[220px_1fr_auto]"}`}>
                    <select
                      value={price.plan}
                      onChange={(event) =>
                        setExtraPrices((prev) => prev.map((item, i) => (i === index ? { ...item, plan: event.target.value } : item)))
                      }
                      className={selectClass}
                    >
                      {planOptions.map((plan) => (
                        <option key={plan.value} value={plan.value}>
                          {plan.label}
                        </option>
                      ))}
                      <option value={CUSTOM_PLAN_VALUE}>Custom</option>
                    </select>
                    {price.plan === CUSTOM_PLAN_VALUE && (
                      <input
                        value={price.customLabel || ""}
                        onChange={(event) =>
                          setExtraPrices((prev) => prev.map((item, i) => (i === index ? { ...item, customLabel: event.target.value } : item)))
                        }
                        className={fieldClass}
                        placeholder="Game name"
                      />
                    )}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.price}
                      onChange={(event) =>
                        setExtraPrices((prev) => prev.map((item, i) => (i === index ? { ...item, price: Number(event.target.value) } : item)))
                      }
                      className={fieldClass}
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
                <button type="button" onClick={addExtraPrice} className={primaryButtonClass}>
                  <Plus className="mr-1 inline h-4 w-4" />
                  Plan Add
                </button>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Loader Download URL</label>
                <input
                  value={form.defaultLoaderUrl}
                  onChange={(event) => updateField("defaultLoaderUrl", event.target.value)}
                  className={fieldClass}
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
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="admin-btn-primary px-5 py-2.5 disabled:opacity-60"
          >
            {loading ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
      <aside className="h-fit rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(22,22,30,0.94),rgba(9,10,15,0.98))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.32)] xl:sticky xl:top-20">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Live preview</p>
            <h3 className="mt-1 text-sm font-semibold text-white">Store card</h3>
          </div>
          <span className="rounded-full border border-[#b9accf]/25 bg-[#a996c4]/10 px-2 py-1 text-[10px] font-semibold text-[#e0d7ef]">
            {previewStatusLabel}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
          <div className="flex h-40 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(169,150,196,0.18),transparent_48%),linear-gradient(180deg,rgba(18,19,26,0.98),rgba(8,9,13,1))]">
            {previewImage ? (
              <img src={previewImage} alt="Product preview" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-9 w-9 text-zinc-600" />
            )}
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{form.category || "Product"}</p>
              <h4 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight text-white">{form.name || "Untitled product"}</h4>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{form.shortDescription || form.description || "Short product description appears here."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400">{previewPlanLabel}</span>
              <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400">{form.stockStatus.replace(/_/g, " ")}</span>
              {form.isFeatured ? <span className="rounded-lg border border-[#b9accf]/25 bg-[#a996c4]/10 px-2 py-1 text-[10px] text-[#e0d7ef]">Featured</span> : null}
            </div>
            <div className="flex items-end justify-between border-t border-white/[0.07] pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">From</p>
                <p className="text-lg font-bold text-white">{previewPriceLabel}</p>
              </div>
              <span className="rounded-xl bg-[#a996c4] px-3 py-2 text-xs font-bold text-white">View</span>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Page URL</p>
          <p className="mt-1 truncate text-xs text-zinc-300">/products/{computedSlug || "product-slug"}</p>
        </div>
      </aside>
      </div>
    </form>
  );
}
