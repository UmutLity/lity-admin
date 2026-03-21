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
import {
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
  key: "",
  status: "ACTIVE",
  downloadUrl: "",
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

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const getErrorMessage = (data: any) => {
    if (data?.error) return data.error as string;
    const firstValidationError = Object.values(data?.errors || {})[0];
    return typeof firstValidationError === "string" ? firstValidationError : "Unknown error";
  };

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
      key: license.key,
      status: license.status,
      downloadUrl: license.downloadUrl || "",
      expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 16) : "",
      note: license.note || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.key || !form.downloadUrl) {
      addToast({ type: "error", title: "Missing fields", description: "Product, license key and Mega link are required" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: form.customerId || null,
        productId: form.productId,
        plan: form.plan,
        key: form.key.trim(),
        status: form.status,
        downloadUrl: form.downloadUrl.trim(),
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

      addToast({ type: "success", title: editing ? "License updated" : "License created" });
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
      <Topbar title="Licenses" description="Manage private loader links and the license keys attached to them.">
        <Button
          onClick={openCreate}
          className="rounded-2xl border-0 bg-[linear-gradient(135deg,#ff8a1a,#ff6a00)] px-5 text-white shadow-[0_14px_34px_rgba(255,106,0,0.28)] hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Add License
        </Button>
      </Topbar>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>{stats.active} active</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
          <KeyRound className="h-4 w-4 text-orange-400" />
          <span>{stats.total} total keys</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
          <Download className="h-4 w-4 text-violet-400" />
          <span>{stats.downloads} downloads</span>
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
              className="h-12 rounded-2xl border-white/[0.06] bg-[#0b111d] pl-11 text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/30 focus:ring-orange-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
        ) : licenses.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={KeyRound}
              title="No licenses yet"
              description="Create your first license and attach its private Mega link."
            >
              <Button
                onClick={openCreate}
                className="rounded-2xl border-0 bg-[linear-gradient(135deg,#ff8a1a,#ff6a00)] text-white"
              >
                <Plus className="h-4 w-4" /> Add License
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#0c111d]/70">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">License</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Download Link</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Owner</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Downloads</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {licenses.map((license) => (
                  <tr key={license.id} className="group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,138,26,0.14),rgba(255,106,0,0.08))] text-orange-400">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{license.key}</p>
                            <button
                              type="button"
                              onClick={() => copyLicenseKey(license.key)}
                              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={cn("border text-[10px] tracking-[0.18em]", statusStyles[license.status])}>
                              {license.status}
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{license.plan}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{license.product.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">/{license.product.slug}</p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {license.downloadUrl ? (
                        <a
                          href={license.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-[340px] items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
                        >
                          <Link2 className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                          <span className="truncate">{truncateLink(license.downloadUrl)}</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-600">No link assigned</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {license.customer ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-200">{license.customer.username}</p>
                          <p className="truncate text-xs text-zinc-500">{license.customer.email}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-600">Unassigned</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="inline-flex min-w-[48px] items-center justify-center rounded-xl bg-[#131c2b] px-3 py-1.5 text-sm font-semibold text-slate-200">
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-zinc-500 hover:bg-white/[0.04] hover:text-white"
                            >
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
        <DialogContent className="max-w-2xl border-white/[0.08] bg-[#0d1424]">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? "Edit License" : "Add License"}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Assign a license key to a private Mega link and optionally bind it to a customer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Product</Label>
              <Select
                value={form.productId}
                onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
                options={[
                  { value: "", label: "Select product" },
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
              <Label>License Key</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                placeholder="litysoftware1"
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
              <Label>Mega Download URL</Label>
              <Input
                value={form.downloadUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, downloadUrl: e.target.value }))}
                placeholder="https://mega.nz/file/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Expires At</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Internal note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              loading={saving}
              className="rounded-xl border-0 bg-[linear-gradient(135deg,#ff8a1a,#ff6a00)] text-white"
            >
              <Download className="h-4 w-4" /> {editing ? "Save Changes" : "Create License"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="border-white/[0.08] bg-[#0d1424]">
          <DialogHeader>
            <DialogTitle className="text-white">Delete License</DialogTitle>
            <DialogDescription className="text-zinc-500">
              This will permanently remove the license mapping and its private download access.
            </DialogDescription>
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
