"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Copy, ExternalLink, KeyRound, Link2, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Customer = {
  id: string;
  username: string;
  email: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  defaultLoaderUrl?: string | null;
};

type LicenseRecord = {
  id: string;
  key: string;
  plan: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  downloadUrl: string | null;
  note: string | null;
  downloadCount: number;
  expiresAt: string | null;
  lastDownloadedAt: string | null;
  createdAt: string;
  customer: Customer | null;
  product: Product;
};

const emptyForm = {
  customerId: "",
  productId: "",
  plan: "LIFETIME",
  keyInput: "",
  status: "ACTIVE",
  expiresAt: "",
  note: "",
};

const statusStyles: Record<LicenseRecord["status"], string> = {
  ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  EXPIRED: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  REVOKED: "border-red-500/20 bg-red-500/10 text-red-300",
};

function truncateLink(url: string | null) {
  if (!url) return "No link assigned";
  return url.length > 44 ? `${url.slice(0, 44)}...` : url;
}

export default function LicensesPage() {
  const { addToast } = useToast();
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<LicenseRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const [licenseRes, customerRes, productRes] = await Promise.all([
        fetch(`/api/admin/licenses?${params.toString()}`, { credentials: "include" }),
        fetch("/api/admin/customers", { credentials: "include" }),
        fetch("/api/admin/products", { credentials: "include" }),
      ]);

      const [licenseData, customerData, productData] = await Promise.all([
        licenseRes.json(),
        customerRes.json(),
        productRes.json(),
      ]);

      setLicenses(licenseData.data || []);
      setCustomers(customerData.data || []);
      setProducts(productData.data || []);
    } catch (error) {
      console.error(error);
      addToast({ type: "error", title: "Error", description: "Could not load licenses" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const stats = useMemo(() => ({
    total: licenses.length,
    active: licenses.filter((item) => item.status === "ACTIVE").length,
    downloads: licenses.reduce((sum, item) => sum + item.downloadCount, 0),
  }), [licenses]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) || null,
    [products, form.productId]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const getErrorMessage = (data: any) => {
    if (data?.error) return data.error as string;
    const firstValidationError = Object.values(data?.errors || {})[0];
    return typeof firstValidationError === "string" ? firstValidationError : "Unknown error";
  };

  const parseKeys = () =>
    form.keyInput
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (license: LicenseRecord) => {
    setEditing(license);
    setForm({
      customerId: license.customer?.id || "",
      productId: license.product.id,
      plan: license.plan,
      keyInput: license.key,
      status: license.status,
      expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 16) : "",
      note: license.note || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    const parsedKeys = parseKeys();
    if (!form.productId || parsedKeys.length === 0) {
      addToast({ type: "error", title: "Missing fields", description: "At least one key and one product are required" });
      return;
    }

    if (!selectedProduct?.defaultLoaderUrl) {
      addToast({ type: "error", title: "Missing loader link", description: "Selected product does not have a default Mega link yet" });
      return;
    }

    if (editing && parsedKeys.length !== 1) {
      addToast({ type: "error", title: "Edit mode", description: "You can only edit one license key at a time" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: form.customerId || null,
        productId: form.productId,
        plan: form.plan,
        key: parsedKeys[0],
        keys: !editing ? parsedKeys : undefined,
        status: form.status,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        note: form.note.trim() || null,
      };

      const res = await fetch(editing ? `/api/admin/licenses/${editing.id}` : "/api/admin/licenses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: "Save failed", description: getErrorMessage(data) });
        return;
      }

      addToast({
        type: "success",
        title: editing ? "License updated" : "Licenses added",
        description: editing ? "License updated successfully" : `${data.createdCount || parsedKeys.length} licenses created`,
      });
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      addToast({ type: "error", title: "Error", description: "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/licenses/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        addToast({ type: "error", title: "Delete failed", description: data.error || "Unknown error" });
        return;
      }

      addToast({ type: "success", title: "License deleted" });
      setDeleteId(null);
      loadData();
    } catch (error) {
      console.error(error);
      addToast({ type: "error", title: "Error", description: "Delete request failed" });
    } finally {
      setDeleting(false);
    }
  };

  const copyLicenseKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    addToast({ type: "success", title: "Copied", description: `${key} copied to clipboard` });
  };

  return (
    <div className="space-y-6">
      <Topbar title="Licenses" description="Assign product-based loader access and add keys in bulk.">
        <Button onClick={openCreate} className="rounded-2xl bg-violet-500 text-white hover:bg-violet-400">
          <Plus className="h-4 w-4" /> Add Licenses
        </Button>
      </Topbar>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Total Keys</p>
              <p className="text-2xl font-semibold text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Active</p>
              <p className="text-2xl font-semibold text-white">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Downloads</p>
              <p className="text-2xl font-semibold text-white">{stats.downloads}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search licenses, products or customers..."
              className="h-12 rounded-2xl border-white/[0.06] bg-[#14141c] pl-11 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
        ) : licenses.length === 0 ? (
          <div className="p-10">
            <EmptyState icon={KeyRound} title="No licenses yet" description="Pick a product, then bulk add license keys.">
              <Button onClick={openCreate} className="rounded-2xl bg-violet-500 text-white hover:bg-violet-400">
                <Plus className="h-4 w-4" /> Add Licenses
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">License</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Loader Link</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Owner</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Downloads</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {licenses.map((license) => (
                  <tr key={license.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-300">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{license.key}</p>
                            <button type="button" onClick={() => copyLicenseKey(license.key)} className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={cn("border text-[10px] tracking-[0.18em]", statusStyles[license.status])}>{license.status}</Badge>
                            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{license.plan}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">{license.product.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">/{license.product.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      {license.downloadUrl ? (
                        <a href={license.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-[340px] items-center gap-2 text-sm text-zinc-300 hover:text-white">
                          <Link2 className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                          <span className="truncate">{truncateLink(license.downloadUrl)}</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-600">No loader link</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {license.customer ? (
                        <>
                          <p className="text-sm font-medium text-zinc-200">{license.customer.username}</p>
                          <p className="mt-1 text-xs text-zinc-500">{license.customer.email}</p>
                        </>
                      ) : (
                        <span className="text-sm text-zinc-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex min-w-[48px] items-center justify-center rounded-xl bg-[#151a2a] px-3 py-1.5 text-sm font-semibold text-slate-200">
                        {license.downloadCount}
                      </div>
                      <p className="mt-2 text-xs text-zinc-600">
                        {license.lastDownloadedAt ? `Last ${formatDate(license.lastDownloadedAt)}` : `Created ${formatDate(license.createdAt)}`}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-500 hover:bg-white/[0.04] hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-white/[0.08] bg-[#0d1424]">
                            <DropdownMenuItem onClick={() => openEdit(license)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLicenseKey(license.key)}>
                              <Copy className="mr-2 h-4 w-4" /> Copy Key
                            </DropdownMenuItem>
                            {license.downloadUrl && (
                              <DropdownMenuItem asChild>
                                <a href={license.downloadUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> Open Link
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-white/[0.06]" />
                            <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteId(license.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl border-white/[0.08] bg-[#141b2d]">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-3xl font-bold tracking-tight text-white">{editing ? "Edit License" : "Add Licenses"}</DialogTitle>
                <DialogDescription className="mt-2 text-sm text-zinc-500">
                  Add one or many keys. The selected product's default Mega link will be assigned automatically.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>License Keys {editing ? "" : "* (one per line)"}</Label>
              <textarea
                value={form.keyInput}
                onChange={(e) => setForm((prev) => ({ ...prev, keyInput: e.target.value }))}
                rows={6}
                placeholder={"Enter license keys, one per line:\nABC123-XYZ789\nDEF456-UVW012"}
                className="w-full rounded-2xl border border-white/[0.08] bg-[#1a2334] px-4 py-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/40"
              />
              <p className="text-xs text-zinc-500">Bulk addition: enter multiple keys, each on a separate line.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Product *</Label>
                <Select
                  value={form.productId}
                  onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
                  options={[
                    { value: "", label: "Select a product" },
                    ...products.map((product) => ({ value: product.id, label: product.name })),
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={form.plan}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}
                  options={[
                    { value: "DAILY", label: "Daily" },
                    { value: "WEEKLY", label: "Weekly" },
                    { value: "MONTHLY", label: "Monthly" },
                    { value: "LIFETIME", label: "Lifetime" },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "EXPIRED", label: "Expired" },
                    { value: "REVOKED", label: "Revoked" },
                  ]}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Customer</Label>
                <Select
                  value={form.customerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                  options={[
                    { value: "", label: "No customer assigned" },
                    ...customers.map((customer) => ({ value: customer.id, label: `${customer.username} (${customer.email})` })),
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Internal note" />
              </div>
            </div>

            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
                <Link2 className="h-4 w-4" />
                Product Loader Link
              </div>
              {selectedProduct?.defaultLoaderUrl ? (
                <a href={selectedProduct.defaultLoaderUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 text-sm text-zinc-300 hover:text-white">
                  <span className="truncate">{selectedProduct.defaultLoaderUrl}</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">Select a product with a configured default Mega link.</p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="rounded-xl bg-violet-500 text-white hover:bg-violet-400">
              {editing ? "Save Changes" : "Add Licenses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="border-white/[0.08] bg-[#0d1424]">
          <DialogHeader>
            <DialogTitle className="text-white">Delete License</DialogTitle>
            <DialogDescription className="text-zinc-500">This will permanently remove the selected key.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
