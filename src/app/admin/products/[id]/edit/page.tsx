"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Upload,
  Image as ImageIcon,
  ArrowLeft,
  Star,
  List,
  Layout,
  Settings2,
  ImagePlus,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────
interface PriceEntry {
  plan: string;
  price: number;
}

interface Feature {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
}

interface GalleryImage {
  id: string;
  url: string;
  altText: string | null;
  order: number;
  isThumbnail: boolean;
}

interface Specification {
  id: string;
  label: string;
  value: string;
  order: number;
}

// ─── Constants ─────────────────────────────────────────
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
  { value: "DETECTED", label: "Detected" },
  { value: "UPDATING", label: "Updating" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

const planOptions = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "LIFETIME", label: "Lifetime" },
];

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];

const tabs = [
  { key: "basic", label: "Basic Info", icon: Layout },
  { key: "features", label: "Features", icon: Star },
  { key: "gallery", label: "Gallery", icon: ImageIcon },
  { key: "specifications", label: "Specifications", icon: List },
] as const;

type TabKey = (typeof tabs)[number]["key"];

// ─── Main Page ─────────────────────────────────────────
export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const productId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [autoSlug, setAutoSlug] = useState(false);

  // ── Basic Info form state
  const [form, setForm] = useState({
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    longDescription: "",
    technicalDescription: "",
    featureSectionTitle: "",
    category: "OTHER",
    status: "UNDETECTED",
    statusNote: "",
    isFeatured: false,
    isActive: true,
    currency: "USD",
    buyUrl: "",
    displayOrder: 0,
    sortOrder: 0,
  });

  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Features state
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [editFeatureData, setEditFeatureData] = useState<Partial<Feature>>({});
  const [newFeature, setNewFeature] = useState({ title: "", description: "", icon: "", order: 0 });

  // ── Gallery state
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [newImage, setNewImage] = useState({ url: "", altText: "", isThumbnail: false });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Specifications state
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editSpecData, setEditSpecData] = useState<Partial<Specification>>({});
  const [newSpec, setNewSpec] = useState({ label: "", value: "", order: 0 });

  // ─── Fetch product ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/products/${productId}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success && data.data) {
          const p = data.data;
          setProduct(p);
          setForm({
            name: p.name || "",
            slug: p.slug || "",
            shortDescription: p.shortDescription || "",
            description: p.description || "",
            longDescription: p.longDescription || "",
            technicalDescription: p.technicalDescription || "",
            featureSectionTitle: p.featureSectionTitle || "",
            category: p.category || "OTHER",
            status: p.status || "UNDETECTED",
            statusNote: p.statusNote || "",
            isFeatured: p.isFeatured ?? false,
            isActive: p.isActive ?? true,
            currency: p.currency || "USD",
            buyUrl: p.buyUrl || "",
            displayOrder: p.displayOrder ?? 0,
            sortOrder: p.sortOrder ?? 0,
          });
          setPrices(
            p.prices?.map((pr: any) => ({ plan: pr.plan, price: pr.price })) || []
          );
        }
      } catch (error) {
        console.error(error);
        addToast({ type: "error", title: "Error", description: "Failed to load product" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  // Auto-slug
  useEffect(() => {
    if (autoSlug && form.name) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, autoSlug]);

  // ─── Basic Info helpers ─────────────────────────────
  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: "" }));
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

  const handleSaveProduct = async () => {
    setSaving(true);
    setFormErrors({});
    try {
      const body = {
        ...form,
        sortOrder: Number(form.sortOrder),
        displayOrder: Number(form.displayOrder),
        prices: prices.map((p) => ({ plan: p.plan, price: Number(p.price) })),
      };

      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setFormErrors(data.errors);
        addToast({
          type: "error",
          title: "Error",
          description: data.error || "Failed to save product",
        });
        return;
      }

      addToast({
        type: "success",
        title: "Saved",
        description: `${form.name} updated successfully`,
      });
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      addToast({ type: "error", title: "Error", description: "An error occurred" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Features CRUD ──────────────────────────────────
  const fetchFeatures = useCallback(async () => {
    setFeaturesLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/features`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setFeatures(data.data || []);
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to load features" });
    } finally {
      setFeaturesLoading(false);
    }
  }, [productId]);

  const addFeature = async () => {
    if (!newFeature.title.trim()) {
      addToast({ type: "warning", title: "Warning", description: "Title is required" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${productId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newFeature.title,
          description: newFeature.description || null,
          icon: newFeature.icon || null,
          order: Number(newFeature.order) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeatures((prev) => [...prev, data.data]);
        setNewFeature({ title: "", description: "", icon: "", order: 0 });
        addToast({ type: "success", title: "Added", description: "Feature added" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to add feature" });
    }
  };

  const saveFeatureEdit = async (featureId: string) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ featureId, ...editFeatureData }),
      });
      const data = await res.json();
      if (data.success) {
        setFeatures((prev) => prev.map((f) => (f.id === featureId ? data.data : f)));
        setEditingFeatureId(null);
        addToast({ type: "success", title: "Updated", description: "Feature updated" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to update feature" });
    }
  };

  const deleteFeature = async (featureId: string) => {
    if (!confirm("Are you sure you want to delete this feature?")) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}/features`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ featureId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeatures((prev) => prev.filter((f) => f.id !== featureId));
        addToast({ type: "success", title: "Deleted", description: "Feature deleted" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to delete feature" });
    }
  };

  // ─── Gallery CRUD ───────────────────────────────────
  const fetchGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/gallery`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setGallery(data.data || []);
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to load gallery" });
    } finally {
      setGalleryLoading(false);
    }
  }, [productId]);

  const addGalleryImage = async () => {
    if (!newImage.url.trim()) {
      addToast({ type: "warning", title: "Warning", description: "URL is required" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${productId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: newImage.url,
          altText: newImage.altText || null,
          order: 0,
          isThumbnail: newImage.isThumbnail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGallery((prev) => [...prev, data.data]);
        setNewImage({ url: "", altText: "", isThumbnail: false });
        addToast({ type: "success", title: "Added", description: "Image added to gallery" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to add image" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/media", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setNewImage((prev) => ({ ...prev, url: data.data.url }));
        addToast({ type: "success", title: "Uploaded", description: "File uploaded, URL filled" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Upload failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "File upload failed" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteGalleryImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}/gallery`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageId }),
      });
      const data = await res.json();
      if (data.success) {
        setGallery((prev) => prev.filter((img) => img.id !== imageId));
        addToast({ type: "success", title: "Deleted", description: "Image deleted" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to delete image" });
    }
  };

  // ─── Specifications CRUD ────────────────────────────
  const fetchSpecs = useCallback(async () => {
    setSpecsLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/specifications`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setSpecs(data.data || []);
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to load specifications" });
    } finally {
      setSpecsLoading(false);
    }
  }, [productId]);

  const addSpec = async () => {
    if (!newSpec.label.trim() || !newSpec.value.trim()) {
      addToast({ type: "warning", title: "Warning", description: "Label and value are required" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${productId}/specifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: newSpec.label,
          value: newSpec.value,
          order: Number(newSpec.order) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => [...prev, data.data]);
        setNewSpec({ label: "", value: "", order: 0 });
        addToast({ type: "success", title: "Added", description: "Specification added" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to add specification" });
    }
  };

  const saveSpecEdit = async (specId: string) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}/specifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ specId, ...editSpecData }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => prev.map((s) => (s.id === specId ? data.data : s)));
        setEditingSpecId(null);
        addToast({ type: "success", title: "Updated", description: "Specification updated" });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to update specification" });
    }
  };

  const deleteSpec = async (specId: string) => {
    if (!confirm("Are you sure you want to delete this specification?")) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}/specifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ specId }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => prev.filter((s) => s.id !== specId));
        addToast({ type: "success", title: "Deleted", description: "Specification deleted" });
      }
    } catch {
      addToast({ type: "error", title: "Error", description: "Failed to delete specification" });
    }
  };

  // ─── Tab data loading ──────────────────────────────
  useEffect(() => {
    if (!loading && product) {
      if (activeTab === "features" && features.length === 0 && !featuresLoading) {
        fetchFeatures();
      }
      if (activeTab === "gallery" && gallery.length === 0 && !galleryLoading) {
        fetchGallery();
      }
      if (activeTab === "specifications" && specs.length === 0 && !specsLoading) {
        fetchSpecs();
      }
    }
  }, [activeTab, loading, product]);

  // ─── Loading skeleton ──────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-48 bg-[#111827] rounded animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-[#111827] animate-pulse rounded-lg border border-[#1e293b]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-gray-400 mb-6">No product found with this ID.</p>
          <button
            onClick={() => router.push("/admin/products")}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/admin/products")}
            className="p-2 rounded-lg hover:bg-[#111827] border border-[#1e293b] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit: {product.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">/{product.slug}</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-1 mb-6 border-b border-[#1e293b] overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  activeTab === tab.key
                    ? "text-purple-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "basic" && (
          <BasicInfoTab
            form={form}
            formErrors={formErrors}
            autoSlug={autoSlug}
            prices={prices}
            saving={saving}
            updateField={updateField}
            setAutoSlug={setAutoSlug}
            addPrice={addPrice}
            removePrice={removePrice}
            updatePrice={updatePrice}
            onSave={handleSaveProduct}
          />
        )}

        {activeTab === "features" && (
          <FeaturesTab
            features={features}
            loading={featuresLoading}
            newFeature={newFeature}
            setNewFeature={setNewFeature}
            editingFeatureId={editingFeatureId}
            editFeatureData={editFeatureData}
            onAdd={addFeature}
            onStartEdit={(f) => {
              setEditingFeatureId(f.id);
              setEditFeatureData({ title: f.title, description: f.description || "", icon: f.icon || "", order: f.order });
            }}
            onCancelEdit={() => setEditingFeatureId(null)}
            onSaveEdit={saveFeatureEdit}
            onDelete={deleteFeature}
            setEditFeatureData={setEditFeatureData}
            onRefresh={fetchFeatures}
          />
        )}

        {activeTab === "gallery" && (
          <GalleryTab
            gallery={gallery}
            loading={galleryLoading}
            newImage={newImage}
            setNewImage={setNewImage}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onAdd={addGalleryImage}
            onFileUpload={handleFileUpload}
            onDelete={deleteGalleryImage}
            onRefresh={fetchGallery}
          />
        )}

        {activeTab === "specifications" && (
          <SpecificationsTab
            specs={specs}
            loading={specsLoading}
            newSpec={newSpec}
            setNewSpec={setNewSpec}
            editingSpecId={editingSpecId}
            editSpecData={editSpecData}
            onAdd={addSpec}
            onStartEdit={(s) => {
              setEditingSpecId(s.id);
              setEditSpecData({ label: s.label, value: s.value, order: s.order });
            }}
            onCancelEdit={() => setEditingSpecId(null)}
            onSaveEdit={saveSpecEdit}
            onDelete={deleteSpec}
            setEditSpecData={setEditSpecData}
            onRefresh={fetchSpecs}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 1: BASIC INFO
// ═══════════════════════════════════════════════════════
function BasicInfoTab({
  form,
  formErrors,
  autoSlug,
  prices,
  saving,
  updateField,
  setAutoSlug,
  addPrice,
  removePrice,
  updatePrice,
  onSave,
}: {
  form: any;
  formErrors: Record<string, string>;
  autoSlug: boolean;
  prices: PriceEntry[];
  saving: boolean;
  updateField: (key: string, value: any) => void;
  setAutoSlug: (v: boolean) => void;
  addPrice: () => void;
  removePrice: (i: number) => void;
  updatePrice: (i: number, key: string, value: any) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info Card */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Product Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Product name"
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  {formErrors.name && <p className="text-xs text-red-400">{formErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Slug *</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      Auto
                    </label>
                  </div>
                  <input
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    disabled={autoSlug}
                    placeholder="product-slug"
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                  {formErrors.slug && <p className="text-xs text-red-400">{formErrors.slug}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Short Description</label>
                <input
                  value={form.shortDescription}
                  onChange={(e) => updateField("shortDescription", e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Description (Markdown)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="# Title&#10;&#10;Detailed description..."
                  rows={8}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Long Description (Markdown)</label>
                <textarea
                  value={form.longDescription}
                  onChange={(e) => updateField("longDescription", e.target.value)}
                  placeholder="Extended product description..."
                  rows={8}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">
                  Technical Description (Markdown, optional)
                </label>
                <textarea
                  value={form.technicalDescription}
                  onChange={(e) => updateField("technicalDescription", e.target.value)}
                  placeholder="Technical details, requirements..."
                  rows={6}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">
                  Feature Section Title (optional)
                </label>
                <input
                  value={form.featureSectionTitle}
                  onChange={(e) => updateField("featureSectionTitle", e.target.value)}
                  placeholder="e.g. Key Features"
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pricing</h3>
              <button
                type="button"
                onClick={addPrice}
                disabled={prices.length >= 4}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg border border-purple-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" /> Add Price
              </button>
            </div>
            {prices.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No prices added yet. Click the button above to add a price.
              </p>
            ) : (
              <div className="space-y-3">
                {prices.map((price, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <select
                      value={price.plan}
                      onChange={(e) => updatePrice(idx, "plan", e.target.value)}
                      className="px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500 w-40"
                    >
                      {planOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.price}
                      onChange={(e) => updatePrice(idx, "price", e.target.value)}
                      className="w-32 px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="0.00"
                    />
                    <span className="text-sm text-gray-400">{form.currency}</span>
                    <button
                      type="button"
                      onClick={() => removePrice(idx)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Category */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Status &amp; Category</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Status Note</label>
                <input
                  value={form.statusNote}
                  onChange={(e) => updateField("statusNote", e.target.value)}
                  placeholder="Update note..."
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  {currencyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Buy URL</label>
                <input
                  value={form.buyUrl}
                  onChange={(e) => updateField("buyUrl", e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => updateField("displayOrder", e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => updateField("sortOrder", e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Visibility</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Active</label>
                <button
                  type="button"
                  onClick={() => updateField("isActive", !form.isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isActive ? "bg-purple-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Featured</label>
                <button
                  type="button"
                  onClick={() => updateField("isFeatured", !form.isFeatured)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isFeatured ? "bg-purple-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.isFeatured ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 2: FEATURES
// ═══════════════════════════════════════════════════════
function FeaturesTab({
  features,
  loading,
  newFeature,
  setNewFeature,
  editingFeatureId,
  editFeatureData,
  onAdd,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  setEditFeatureData,
  onRefresh,
}: {
  features: Feature[];
  loading: boolean;
  newFeature: { title: string; description: string; icon: string; order: number };
  setNewFeature: (v: any) => void;
  editingFeatureId: string | null;
  editFeatureData: Partial<Feature>;
  onAdd: () => void;
  onStartEdit: (f: Feature) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  setEditFeatureData: (v: any) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-[#111827] animate-pulse rounded-xl border border-[#1e293b]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Feature Form */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-purple-400" />
          Add Feature
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Title *</label>
            <input
              value={newFeature.title}
              onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
              placeholder="Feature title"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Description</label>
            <input
              value={newFeature.description}
              onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
              placeholder="Description"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Icon</label>
            <input
              value={newFeature.icon}
              onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
              placeholder="e.g. Shield, Zap"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Order</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={newFeature.order}
                onChange={(e) => setNewFeature({ ...newFeature, order: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={onAdd}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature List */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
          <h3 className="text-lg font-semibold">Features ({features.length})</h3>
          <button
            onClick={onRefresh}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
        {features.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No features yet. Add one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {features.map((feature) => (
              <div key={feature.id} className="px-6 py-4">
                {editingFeatureId === feature.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Title</label>
                      <input
                        value={editFeatureData.title || ""}
                        onChange={(e) =>
                          setEditFeatureData((prev: any) => ({ ...prev, title: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Description</label>
                      <input
                        value={(editFeatureData.description as string) || ""}
                        onChange={(e) =>
                          setEditFeatureData((prev: any) => ({ ...prev, description: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Icon</label>
                      <input
                        value={(editFeatureData.icon as string) || ""}
                        onChange={(e) =>
                          setEditFeatureData((prev: any) => ({ ...prev, icon: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editFeatureData.order ?? 0}
                        onChange={(e) =>
                          setEditFeatureData((prev: any) => ({ ...prev, order: Number(e.target.value) }))
                        }
                        className="w-20 px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => onSaveEdit(feature.id)}
                        className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="p-2 bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs text-gray-500 font-mono w-8 text-center flex-shrink-0">
                        #{feature.order}
                      </span>
                      {feature.icon && (
                        <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded flex-shrink-0">
                          {feature.icon}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{feature.title}</p>
                        {feature.description && (
                          <p className="text-sm text-gray-400 truncate">{feature.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                      <button
                        onClick={() => onStartEdit(feature)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(feature.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 3: GALLERY
// ═══════════════════════════════════════════════════════
function GalleryTab({
  gallery,
  loading,
  newImage,
  setNewImage,
  uploading,
  fileInputRef,
  onAdd,
  onFileUpload,
  onDelete,
  onRefresh,
}: {
  gallery: GalleryImage[];
  loading: boolean;
  newImage: { url: string; altText: string; isThumbnail: boolean };
  setNewImage: (v: any) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAdd: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square bg-[#111827] animate-pulse rounded-xl border border-[#1e293b]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Image Form */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-purple-400" />
          Add Image
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Image URL *</label>
              <input
                value={newImage.url}
                onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Alt Text</label>
              <input
                value={newImage.altText}
                onChange={(e) => setNewImage({ ...newImage, altText: e.target.value })}
                placeholder="Image description"
                className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setNewImage({ ...newImage, isThumbnail: !newImage.isThumbnail })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  newImage.isThumbnail ? "bg-purple-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    newImage.isThumbnail ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-300">Is Thumbnail</span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#0a0a1a] border border-[#1e293b] hover:border-purple-500/50 text-gray-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Upload File"}
              </button>
              <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" /> Add to Gallery
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
          <h3 className="text-lg font-semibold">Gallery ({gallery.length})</h3>
          <button
            onClick={onRefresh}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
        {gallery.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No images in the gallery. Add one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            {gallery.map((img) => (
              <div
                key={img.id}
                className="group relative bg-[#0a0a1a] border border-[#1e293b] rounded-xl overflow-hidden"
              >
                <div className="aspect-square relative">
                  <img
                    src={img.url}
                    alt={img.altText || "Gallery image"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23111827' width='200' height='200'/%3E%3Ctext fill='%234b5563' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  {img.isThumbnail && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded-md">
                      Thumbnail
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(img.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-400 truncate">{img.altText || "No alt text"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Order: {img.order}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 4: SPECIFICATIONS
// ═══════════════════════════════════════════════════════
function SpecificationsTab({
  specs,
  loading,
  newSpec,
  setNewSpec,
  editingSpecId,
  editSpecData,
  onAdd,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  setEditSpecData,
  onRefresh,
}: {
  specs: Specification[];
  loading: boolean;
  newSpec: { label: string; value: string; order: number };
  setNewSpec: (v: any) => void;
  editingSpecId: string | null;
  editSpecData: Partial<Specification>;
  onAdd: () => void;
  onStartEdit: (s: Specification) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  setEditSpecData: (v: any) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#111827] animate-pulse rounded-xl border border-[#1e293b]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Spec Form */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-purple-400" />
          Add Specification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Label *</label>
            <input
              value={newSpec.label}
              onChange={(e) => setNewSpec({ ...newSpec, label: e.target.value })}
              placeholder="e.g. Supported OS"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Value *</label>
            <input
              value={newSpec.value}
              onChange={(e) => setNewSpec({ ...newSpec, value: e.target.value })}
              placeholder="e.g. Windows 10/11"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Order</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={newSpec.order}
                onChange={(e) => setNewSpec({ ...newSpec, order: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0a0a1a] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={onAdd}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications Table */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
          <h3 className="text-lg font-semibold">Specifications ({specs.length})</h3>
          <button
            onClick={onRefresh}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
        {specs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No specifications yet. Add one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e293b]">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {specs.map((spec) => (
                  <tr key={spec.id} className="hover:bg-[#0a0a1a]/50 transition-colors">
                    {editingSpecId === spec.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            value={editSpecData.order ?? 0}
                            onChange={(e) =>
                              setEditSpecData((prev: any) => ({
                                ...prev,
                                order: Number(e.target.value),
                              }))
                            }
                            className="w-16 px-2 py-1 bg-[#0a0a1a] border border-[#1e293b] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            value={editSpecData.label || ""}
                            onChange={(e) =>
                              setEditSpecData((prev: any) => ({ ...prev, label: e.target.value }))
                            }
                            className="w-full px-2 py-1 bg-[#0a0a1a] border border-[#1e293b] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            value={editSpecData.value || ""}
                            onChange={(e) =>
                              setEditSpecData((prev: any) => ({ ...prev, value: e.target.value }))
                            }
                            className="w-full px-2 py-1 bg-[#0a0a1a] border border-[#1e293b] rounded text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onSaveEdit(spec.id)}
                              className="p-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={onCancelEdit}
                              className="p-1.5 bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 rounded-lg transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3">
                          <span className="text-xs text-gray-500 font-mono">#{spec.order}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-sm font-medium text-white">{spec.label}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-sm text-gray-300">{spec.value}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onStartEdit(spec)}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onDelete(spec.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
