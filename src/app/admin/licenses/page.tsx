"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Copy, Download, KeyRound, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

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

  const statusCounts = useMemo(() => ({
    active: licenses.filter((item) => item.status === "ACTIVE").length,
    revoked: licenses.filter((item) => item.status === "REVOKED").length,
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
    <div>
      <Topbar title="Licenses" description="Map license keys to private Mega download links.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New License
        </Button>
      </Topbar>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Total Licenses</p><p className="text-2xl font-semibold">{licenses.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Active</p><p className="text-2xl font-semibold">{statusCounts.active}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Total Downloads</p><p className="text-2xl font-semibold">{statusCounts.downloads}</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by license key, customer, product or note..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded bg-muted animate-pulse" />)}</div>
          ) : licenses.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={KeyRound}
                title="No licenses yet"
                description="Create a license key and connect it to a private Mega link."
              >
                <Button onClick={openCreate}><Plus className="h-4 w-4" /> New License</Button>
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">License</th>
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">Customer</th>
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">Product</th>
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">Downloads</th>
                    <th className="text-left p-4 text-xs text-muted-foreground font-medium">Created</th>
                    <th className="w-[60px] p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => (
                    <tr key={license.id} className="border-b last:border-0">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                            <KeyRound className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{license.key}</p>
                              <button type="button" onClick={() => copyLicenseKey(license.key)} className="text-muted-foreground hover:text-foreground">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">{license.plan}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {license.customer ? (
                          <div>
                            <p className="font-medium">{license.customer.username}</p>
                            <p className="text-xs text-muted-foreground">{license.customer.email}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{license.product.name}</p>
                          <p className="text-xs text-muted-foreground">/{license.product.slug}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2 items-start">
                          <Badge variant={license.status === "ACTIVE" ? "success" : license.status === "EXPIRED" ? "secondary" : "destructive"}>
                            {license.status}
                          </Badge>
                          {license.expiresAt && <span className="text-xs text-muted-foreground">Expires {formatDate(license.expiresAt)}</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{license.downloadCount}</p>
                          <p className="text-xs text-muted-foreground">
                            {license.lastDownloadedAt ? `Last ${formatDate(license.lastDownloadedAt)}` : "Never used"}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(license.createdAt)}</td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(license)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLicenseKey(license.key)}>
                              <Copy className="h-4 w-4 mr-2" /> Copy Key
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(license.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit License" : "Create License"}</DialogTitle>
            <DialogDescription>
              Assign a private Mega download link to a specific license key.
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
                placeholder="Optional note for internal tracking"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              <Download className="h-4 w-4" /> {editing ? "Save Changes" : "Create License"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete License</DialogTitle>
            <DialogDescription>This will permanently remove the license mapping and private download access.</DialogDescription>
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
