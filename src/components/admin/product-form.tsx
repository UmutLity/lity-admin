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
import { Trash2, Plus } from "lucide-react";

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
  { value: "OTHER", label: "Diğer" },
];

const statusOptions = [
  { value: "UNDETECTED", label: "Undetected" },
  { value: "DETECTED", label: "Detected" },
  { value: "UPDATING", label: "Updating" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

const planOptions = [
  { value: "DAILY", label: "Günlük" },
  { value: "WEEKLY", label: "Haftalık" },
  { value: "MONTHLY", label: "Aylık" },
  { value: "LIFETIME", label: "Lifetime" },
];

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];

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

  // Auto-generate slug from name
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
      setPrices([...prices, { plan: available.value, price: 0 }]);
    }
  };

  const removePrice = (index: number) => {
    setPrices(prices.filter((_, i) => i !== index));
  };

  const updatePrice = (index: number, key: string, value: any) => {
    const updated = [...prices];
    updated[index] = { ...updated[index], [key]: value };
    setPrices(updated);
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
        const [title = "", description = "", icon = ""] = line.split("|").map((part) => part.trim());
        return { title, description, icon };
      })
      .filter((feature) => feature.title);

    if (!parsed.length) {
      addToast({
        type: "warning",
        title: "Uyari",
        description: "Toplu ekleme icin en az bir gecerli satir girin",
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
      title: "Eklendi",
      description: `${parsed.length} ozellik listeye eklendi`,
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

      const url = isEditing
        ? `/api/admin/products/${initialData.id}`
        : "/api/admin/products";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        }
        addToast({ type: "error", title: "Hata", description: data.error || "İşlem başarısız" });
        return;
      }

      addToast({ type: "success", title: isEditing ? "Güncellendi" : "Oluşturuldu", description: `${form.name} başarıyla ${isEditing ? "güncellendi" : "oluşturuldu"}` });
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      addToast({ type: "error", title: "Hata", description: "Bir hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Ürün Bilgileri</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ürün Adı *</Label>
                  <Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Valorant Full" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slug">Slug *</Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} className="rounded" />
                      Otomatik
                    </label>
                  </div>
                  <Input id="slug" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} disabled={autoSlug} placeholder="valorant-full" />
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Kısa Açıklama</Label>
                <Input id="shortDescription" value={form.shortDescription} onChange={(e) => updateField("shortDescription", e.target.value)} placeholder="Bu ürün hakkında kısa bilgi..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Açıklama (Markdown)</Label>
                <Textarea id="description" value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="# Ürün Başlığı&#10;&#10;Detaylı açıklama..." rows={10} className="font-mono text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fiyatlandırma</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addPrice} disabled={prices.length >= 4}>
                  <Plus className="h-4 w-4" /> Fiyat Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {prices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz fiyat eklenmedi. Yukarıdaki butona tıklayarak fiyat ekleyin.</p>
              ) : (
                <div className="space-y-3">
                  {prices.map((price, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Select
                        options={planOptions}
                        value={price.plan}
                        onChange={(e) => updatePrice(idx, "plan", e.target.value)}
                        className="w-40"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price.price}
                        onChange={(e) => updatePrice(idx, "price", e.target.value)}
                        className="w-32"
                        placeholder="0.00"
                      />
                      <span className="text-sm text-muted-foreground">{form.currency}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePrice(idx)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ã–zellikler</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                  <Plus className="h-4 w-4" /> Ã–zellik Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulkFeatures">Toplu Ekle</Label>
                <Textarea
                  id="bulkFeatures"
                  value={bulkFeatures}
                  onChange={(e) => setBulkFeatures(e.target.value)}
                  placeholder={"Aim Assist|Smooth lock and FOV settings|crosshair\nESP|Player, loot and distance info|radar"}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Her satÄ±rÄ± <code>baÅŸlÄ±k|aÃ§Ä±klama|ikon</code> formatÄ±nda girin. AÃ§Ä±klama ve ikon opsiyoneldir.
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={applyBulkFeatures}>
                  Toplu Listeye Ekle
                </Button>
              </div>

              {features.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  HenÃ¼z Ã¶zellik eklenmedi. Elle ekleyebilir veya toplu yapÄ±ÅŸtÄ±rabilirsiniz.
                </p>
              ) : (
                <div className="space-y-3">
                  {features.map((feature, idx) => (
                    <div key={`${feature.title}-${idx}`} className="rounded-lg border p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>BaÅŸlÄ±k *</Label>
                          <Input
                            value={feature.title}
                            onChange={(e) => updateFeature(idx, "title", e.target.value)}
                            placeholder="Aim Assist"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ä°kon</Label>
                          <Input
                            value={feature.icon}
                            onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                            placeholder="crosshair"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                        <div className="space-y-2">
                          <Label>AÃ§Ä±klama</Label>
                          <Input
                            value={feature.description}
                            onChange={(e) => updateFeature(idx, "description", e.target.value)}
                            placeholder="Smooth lock and FOV settings"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SÄ±ra</Label>
                          <Input
                            type="number"
                            value={feature.order}
                            onChange={(e) => updateFeature(idx, "order", Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(idx)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> KaldÄ±r
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Durum & Kategori</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select options={categoryOptions} value={form.category} onChange={(e) => updateField("category", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select options={statusOptions} value={form.status} onChange={(e) => updateField("status", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statusNote">Status Notu</Label>
                <Input id="statusNote" value={form.statusNote} onChange={(e) => updateField("statusNote", e.target.value)} placeholder="Güncelleme hazırlanıyor..." />
              </div>
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select options={currencyOptions} value={form.currency} onChange={(e) => updateField("currency", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyUrl">Satın Alma URL</Label>
                <Input id="buyUrl" value={form.buyUrl} onChange={(e) => updateField("buyUrl", e.target.value)} placeholder="https://discord.gg/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sıralama</Label>
                <Input id="sortOrder" type="number" value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Görünürlük</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Aktif</Label>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => updateField("isActive", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isFeatured">Öne Çıkan</Label>
                <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(v) => updateField("isFeatured", v)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={loading}>
              {isEditing ? "Güncelle" : "Oluştur"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              İptal
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
