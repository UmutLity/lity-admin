"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Edit,
  Key,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Reseller {
  id: string;
  name: string;
  email: string | null;
  discountPercent: number;
  apiKeyMasked: string | null;
  isActive: boolean;
  saleCount: number;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function ResellersPage() {
  const { addToast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", discountPercent: "" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", discountPercent: "" });

  const fetchResellers = async () => {
    try {
      const res = await fetch("/api/admin/resellers", { credentials: "include" });
      const json = await res.json();
      if (json.success) setResellers(json.data || []);
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Failed to load resellers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchResellers();
  }, []);

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      addToast({ type: "error", title: "Name is required" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim() || undefined,
          discountPercent: parseFloat(addForm.discountPercent) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: "Reseller created" });
        setShowAddForm(false);
        setAddForm({ name: "", email: "", discountPercent: "" });
        fetchResellers();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Failed to create reseller" });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      addToast({ type: "error", title: "Name is required" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/resellers/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          discountPercent: parseFloat(editForm.discountPercent) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: "Reseller updated" });
        setEditId(null);
        fetchResellers();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Failed to update reseller" });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/resellers/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        addToast({ type: "success", title: isActive ? "Deactivated" : "Activated" });
        fetchResellers();
      }
    } catch {
      addToast({ type: "error", title: "Failed to update status" });
    }
  };

  const handleRegenerateKey = async () => {
    if (!regenerateTarget) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/admin/resellers/${regenerateTarget}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: "API key regenerated" });
        setRegenerateTarget(null);
        fetchResellers();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Failed to regenerate key" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/resellers/${deleteTarget}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: "Reseller deleted" });
        setDeleteTarget(null);
        fetchResellers();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Failed to delete" });
    } finally {
      setDeleting(false);
    }
  };

  const copyApiKey = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/resellers/${id}`, { credentials: "include" });
      const json = await res.json();
      if (json.success && json.data?.apiKey) {
        await navigator.clipboard.writeText(json.data.apiKey);
        addToast({ type: "success", title: "API key copied to clipboard" });
      } else {
        addToast({ type: "error", title: "Could not retrieve API key" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to copy" });
    }
  };

  const totalSales = resellers.reduce((s, r) => s + (r.saleCount || 0), 0);

  if (loading && resellers.length === 0) {
    return (
      <div className="min-h-[60vh]">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded bg-[#1e293b] animate-pulse" />
          <div className="h-8 w-56 rounded bg-[#1e293b] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-[#1e293b] rounded w-1/2 mb-3" />
              <div className="h-8 bg-[#1e293b] rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-[#1e293b] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-violet-400" />
          Resellers & Partners
        </h1>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> Add Reseller
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Total Resellers</span>
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white">{resellers.length}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Total Sales</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-white">{totalSales.toLocaleString()}</div>
        </div>
      </div>

      {/* Resellers Table */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        {resellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full bg-[#1e293b] p-4 mb-4">
              <Users className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No resellers yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-4">
              Add your first reseller to start tracking partner sales
            </p>
            <Button onClick={() => setShowAddForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Reseller
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e293b]">
                  <th className="text-left p-3 text-gray-400 font-medium">Name</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Email</th>
                  <th className="text-right p-3 text-gray-400 font-medium">Discount %</th>
                  <th className="text-left p-3 text-gray-400 font-medium">API Key</th>
                  <th className="text-center p-3 text-gray-400 font-medium">Status</th>
                  <th className="text-right p-3 text-gray-400 font-medium">Sales</th>
                  <th className="text-right p-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((r) => (
                  <tr key={r.id} className="border-b border-[#1e293b]/50 last:border-0">
                    <td className="p-3">
                      {editId === r.id ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-[#0a0a1a] border-[#1e293b] text-white h-8 w-40"
                        />
                      ) : (
                        <span className="font-medium text-white">{r.name}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {editId === r.id ? (
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="bg-[#0a0a1a] border-[#1e293b] text-white h-8 w-44"
                        />
                      ) : (
                        <span className="text-gray-300">{r.email || "-"}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editId === r.id ? (
                        <Input
                          type="number"
                          value={editForm.discountPercent}
                          onChange={(e) => setEditForm({ ...editForm, discountPercent: e.target.value })}
                          className="bg-[#0a0a1a] border-[#1e293b] text-white h-8 w-16 text-right"
                        />
                      ) : (
                        <span className="text-gray-300">{r.discountPercent}%</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-400 font-mono">
                          {r.apiKeyMasked || "••••••••"}
                        </code>
                        <button
                          onClick={() => copyApiKey(r.id)}
                          className="p-1.5 rounded hover:bg-[#1e293b] text-gray-400 hover:text-white transition-colors"
                          title="Copy API key"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleActive(r.id, r.isActive)}
                        className="inline-flex items-center gap-1 text-xs"
                      >
                        {r.isActive ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-gray-500" />
                        )}
                        <span className={r.isActive ? "text-emerald-400" : "text-gray-500"}>
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="p-3 text-right text-gray-300">{r.saleCount}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {editId === r.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdate(r.id)}
                              className="h-8 text-emerald-400 hover:text-emerald-300"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditId(null)}
                              className="h-8 text-gray-400"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditId(r.id);
                                setEditForm({
                                  name: r.name,
                                  email: r.email || "",
                                  discountPercent: String(r.discountPercent),
                                });
                              }}
                              className="p-2 rounded hover:bg-[#1e293b] text-gray-400 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setRegenerateTarget(r.id)}
                              className="p-2 rounded hover:bg-[#1e293b] text-gray-400 hover:text-white transition-colors"
                              title="Regenerate API key"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(r.id)}
                              className="p-2 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        onClick={fetchResellers}
        disabled={loading}
        className="mt-4 gap-2 border-[#1e293b] text-gray-400 hover:bg-[#111827]"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
      </Button>

      {/* Add Reseller Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="bg-[#111827] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Add Reseller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Name</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="bg-[#0a0a1a] border-[#1e293b] text-white"
                placeholder="Partner name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Email</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="bg-[#0a0a1a] border-[#1e293b] text-white"
                placeholder="partner@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Discount %</Label>
              <Input
                type="number"
                value={addForm.discountPercent}
                onChange={(e) => setAddForm({ ...addForm, discountPercent: e.target.value })}
                className="bg-[#0a0a1a] border-[#1e293b] text-white"
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddForm(false)} className="border-[#1e293b]">
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={creating}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate API Key Confirm */}
      <Dialog open={!!regenerateTarget} onOpenChange={() => setRegenerateTarget(null)}>
        <DialogContent className="bg-[#111827] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Regenerate API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">
            This will invalidate the current API key. Any integrations using the old key will stop
            working. Are you sure?
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRegenerateTarget(null)} className="border-[#1e293b]">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRegenerateKey} loading={regenerating}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#111827] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Delete Reseller</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">
            This action cannot be undone. All associated sales data will be removed.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-[#1e293b]">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
