"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select-native";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import { ProductFormData } from "@/lib/validations/product";
import { Trash2, Plus, Sparkles, Package2 } from "lucide-react";

interface PriceEntry {
  plan: string;
  price: number;
}

interface FeatureEntry {
  title: string;
  description: string;
  icon: string;
  order: number;
}

interface ProductFormProps {
  initialData?: any;
  isEditing?: boolean;
}

const categoryOptions = [
  { value: "VALORANT", label: "Valorant" },
  { value: "CS2", label: "CS2" },
  { value: "SPOOFER", label: "Spoofer" },
  { value: "BYPASS", label: "Bypass" },
  { value: "OTHER", label: "Other" },
];

const statusOptions = [
  { value: "UNDETECTED", label: "Undetected" },
  { value: "DETECTED", label: "Detected" },
  { value: "UPDATING", label: "Updating" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

const planOptions = [
  { value: "DAILY", label: "Daily" },
  { value: "3_DAYS", label: "3 Days" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "3_MONTHS", label: "3 Months" },
  { value: "LIFETIME", label: "Lifetime" },
];

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (EUR)" },
  { value: "TRY", label: "TRY (TL)" },
];

const cardClassName =
  "border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,12,24,0.98))] shadow-[0_18px_60px_rgba(2,6,23,0.45)]";

const inputClassName =
  "border-slate-700/70 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500/70";

export function ProductForm({ initialData, isEditing }: ProductFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!isEditing);

  const [form, setForm] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    shortDescription: initialData?.shortDescription || "",
    description: initialData?.description || "",
    category: initialData?.category || "OTHER",
    status: initialData?.status || "UNDETECTED",
    statusNote: initialData?.statusNote || "",
    isFeatured: initialData?.isFeatured ?? false,
    isActive: initialData?.isActive ?? true,
    currency: initialData?.currency || "USD",
    buyUrl: initialData?.buyUrl || "",
    sortOrder: initialData?.sortOrder ?? 0,
  });

  const [prices, setPrices] = useState<PriceEntry[]>(
    initialData?.prices?.map((p: any) => ({ plan: p.plan, price: p.price })) || []
  );
  const [features, setFeatures] = useState<FeatureEntry[]>(
    initialData?.features?.map((feature: any, index: number) => ({
      title: feature.title || "",
      description: feature.description || "",
      icon: feature.icon || "",
      order: feature.order ?? index,
    })) || []
  );
  const [bulkFeatures, setBulkFeatures] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (autoSlug && form.name) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, autoSlug]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const addPrice = () => {
    const usedPlans = prices.map((p) => p.plan);
    const available = planOptions.find((p) => !usedPlans.includes(p.value));
    if (available) {
      setPrices((prev) => [...prev, { plan: available.value, price: 0 }]);
    }
  };

  const removePrice = (index: number) => {
    setPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePrice = (index: number, key: keyof PriceEntry, value: any) => {
    setPrices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const addFeature = () => {
    setFeatures((prev) => [
      ...prev,
      { title: "", description: "", icon: "", order: prev.length },
    ]);
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((feature, nextIndex) => ({ ...feature, order: nextIndex }))
    );
  };

  const updateFeature = (index: number, key: keyof FeatureEntry, value: string | number) => {
    setFeatures((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const applyBulkFeatures = () => {
    const parsed = bulkFeatures
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title = "", description = "", icon = ""] = line
          .split("|")
          .map((part) => part.trim());
        return { title, description, icon };
      })
      .filter((feature) => feature.title);

    if (!parsed.length) {
      addToast({
        type: "warning",
        title: "Warning",
        description: "Toplu ekleme icin en az bir gecerli satir gerekli.",
      });
      return;
    }

    setFeatures((prev) => [
      ...prev,
      ...parsed.map((feature, index) => ({
        ...feature,
        order: prev.length + index,
      })),
    ]);
    setBulkFeatures("");
    addToast({
      type: "success",
      title: "Added",
      description: `${parsed.length} feature row added.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const body: ProductFormData = {
        ...form,
        displayOrder: Number((form as any).displayOrder ?? form.sortOrder ?? 0),
        sortOrder: Number(form.sortOrder),
        prices: prices.map((p) => ({ plan: p.plan as any, price: Number(p.price) })),
        features: features
          .filter((feature) => feature.title.trim())
          .map((feature, index) => ({
            title: feature.title.trim(),
            description: feature.description.trim() || null,
            icon: feature.icon.trim() || null,
            order: Number(feature.order ?? index),
          })),
      };

      const url = isEditing ? `/api/admin/products/${initialData.id}` : "/api/admin/products";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        addToast({
          type: "error",
          title: "Error",
          description: data.error || "Islem basarisiz.",
        });
        return;
      }

      addToast({
        type: "success",
        title: isEditing ? "Updated" : "Created",
        description: `${form.name} saved successfully.`,
      });
      router.push("/admin/products");
      router.refresh();
    } catch {
      addToast({
        type: "error",
        title: "Error",
        description: "Beklenmeyen bir hata olustu.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className={cardClassName}>
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3 text-sky-300">
                <Package2 className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80">
                  Product Setup
                </span>
              </div>
              <CardTitle className="text-white">Urun Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Urun Adi *</Label>
                  <Input
                    id="name"
                    className={inputClassName}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Valorant Full"
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slug">Slug *</Label>
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950"
                      />
                      Auto
                    </label>
                  </div>
                  <Input
                    id="slug"
                    className={inputClassName}
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    disabled={autoSlug}
                    placeholder="valorant-full"
                  />
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Kisa Aciklama</Label>
                <Input
                  id="shortDescription"
                  className={inputClassName}
                  value={form.shortDescription}
                  onChange={(e) => updateField("shortDescription", e.target.value)}
                  placeholder="Short summary for cards and quick listings"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Aciklama</Label>
                <Textarea
                  id="description"
                  className={`${inputClassName} min-h-[220px] font-mono text-sm`}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="# Product title&#10;&#10;Detailed markdown description..."
                  rows={10}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={cardClassName}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                  Pricing
                </span>
                <CardTitle className="text-white">Fiyat Planlari</CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPrice}
                disabled={prices.length >= planOptions.length}
                className="border-slate-700 bg-slate-950/60 text-slate-100 hover:border-emerald-500/60 hover:bg-emerald-500/10"
              >
                <Plus className="h-4 w-4" /> Fiyat Ekle
              </Button>
            </CardHeader>
            <CardContent>
              {prices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400">
                  Henuz fiyat plani yok. Yukaridaki buton ile plan ekleyin.
                </div>
              ) : (
                <div className="space-y-3">
                  {prices.map((price, idx) => (
                    <div
                      key={`${price.plan}-${idx}`}
                      className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800/90 bg-slate-950/55 p-4 sm:grid-cols-[180px_1fr_auto_auto]"
                    >
                      <Select
                        options={planOptions}
                        value={price.plan}
                        onChange={(e) => updatePrice(idx, "plan", e.target.value)}
                        className={inputClassName}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price.price}
                        onChange={(e) => updatePrice(idx, "price", e.target.value)}
                        className={inputClassName}
                        placeholder="0.00"
                      />
                      <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 px-4 text-sm text-slate-300">
                        {form.currency}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePrice(idx)}
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={cardClassName}>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-violet-300">
                    <Sparkles className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300/80">
                      Highlights
                    </span>
                  </div>
                  <CardTitle className="text-white">Ozellikler</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFeature}
                  className="border-slate-700 bg-slate-950/60 text-slate-100 hover:border-violet-500/60 hover:bg-violet-500/10"
                >
                  <Plus className="h-4 w-4" /> Ozellik Ekle
                </Button>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-slate-300">
                Yeni urun eklerken tek tek yazabilir veya satir satir toplu ekleme yapabilirsiniz.
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/55 p-4">
                <div className="space-y-2">
                  <Label htmlFor="bulkFeatures">Toplu Ekle</Label>
                  <Textarea
                    id="bulkFeatures"
                    className={`${inputClassName} min-h-[120px] font-mono text-sm`}
                    value={bulkFeatures}
                    onChange={(e) => setBulkFeatures(e.target.value)}
                    placeholder={"Aim Assist|Smooth lock and FOV settings|crosshair\nESP|Player, loot and distance info|radar"}
                    rows={4}
                  />
                  <p className="text-xs text-slate-400">
                    Format: <code>baslik|aciklama|ikon</code>. Aciklama ve ikon alanlari bos birakilabilir.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={applyBulkFeatures}
                    className="bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
                  >
                    Toplu Listeye Ekle
                  </Button>
                </div>
              </div>

              {features.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/30 px-4 py-10 text-center text-sm text-slate-400">
                  Henuz ozellik eklenmedi. Elle ekleyebilir veya toplu yapistirabilirsiniz.
                </div>
              ) : (
                <div className="space-y-3">
                  {features.map((feature, idx) => (
                    <div
                      key={`${feature.title}-${idx}`}
                      className="rounded-2xl border border-slate-800/90 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.95))] p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Baslik *</Label>
                          <Input
                            className={inputClassName}
                            value={feature.title}
                            onChange={(e) => updateFeature(idx, "title", e.target.value)}
                            placeholder="Aim Assist"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ikon</Label>
                          <Input
                            className={inputClassName}
                            value={feature.icon}
                            onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                            placeholder="crosshair"
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                        <div className="space-y-2">
                          <Label>Aciklama</Label>
                          <Input
                            className={inputClassName}
                            value={feature.description}
                            onChange={(e) => updateFeature(idx, "description", e.target.value)}
                            placeholder="Smooth lock and FOV settings"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sira</Label>
                          <Input
                            type="number"
                            className={inputClassName}
                            value={feature.order}
                            onChange={(e) => updateFeature(idx, "order", Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(idx)}
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" /> Kaldir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cardClassName}>
            <CardHeader className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/80">
                Settings
              </span>
              <CardTitle className="text-white">Durum ve Kategori</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  options={categoryOptions}
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  options={statusOptions}
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statusNote">Status Notu</Label>
                <Input
                  id="statusNote"
                  className={inputClassName}
                  value={form.statusNote}
                  onChange={(e) => updateField("statusNote", e.target.value)}
                  placeholder="Status aciklamasi"
                />
              </div>
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select
                  options={currencyOptions}
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyUrl">Satin Alma URL</Label>
                <Input
                  id="buyUrl"
                  className={inputClassName}
                  value={form.buyUrl}
                  onChange={(e) => updateField("buyUrl", e.target.value)}
                  placeholder="https://discord.gg/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Siralama</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  className={inputClassName}
                  value={form.sortOrder}
                  onChange={(e) => updateField("sortOrder", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={cardClassName}>
            <CardHeader className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Visibility
              </span>
              <CardTitle className="text-white">Gorunurluk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
                <div>
                  <Label htmlFor="isActive">Aktif</Label>
                  <p className="text-xs text-slate-400">Public listelerde gorunsun.</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => updateField("isActive", v)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
                <div>
                  <Label htmlFor="isFeatured">One Cikan</Label>
                  <p className="text-xs text-slate-400">Anasayfada vurgulu goster.</p>
                </div>
                <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(v) => updateField("isFeatured", v)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 bg-sky-500 text-slate-950 hover:bg-sky-400"
              loading={loading}
            >
              {isEditing ? "Guncelle" : "Olustur"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="border-slate-700 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
            >
              Iptal
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
