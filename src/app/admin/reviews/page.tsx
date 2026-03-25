"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Plus, Trash2, Eye, EyeOff, Pencil, Save, X } from "lucide-react";

type Review = {
  id: string;
  source: string;
  sourceMessageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  rating: number | null;
  isVisible: boolean;
  createdAt: string;
};

type FormState = {
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  rating: number;
  isVisible: boolean;
  source: string;
};

const initialForm: FormState = {
  authorName: "",
  authorAvatarUrl: "",
  content: "",
  rating: 5,
  isVisible: true,
  source: "MANUAL",
};

export default function AdminReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(initialForm);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setRows(data.data || []);
      } else {
        setError(data.error || "Failed to load reviews");
      }
    } catch {
      setError("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalVisible = useMemo(() => rows.filter((r) => r.isVisible).length, [rows]);

  const createReview = async () => {
    clearMessages();
    if (!form.authorName.trim() || !form.content.trim()) {
      setError("Author name and content are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        authorName: form.authorName.trim(),
        authorAvatarUrl: form.authorAvatarUrl.trim() || null,
        content: form.content.trim(),
        rating: form.rating >= 1 && form.rating <= 5 ? form.rating : null,
        isVisible: form.isVisible,
        source: form.source.trim() || "MANUAL",
      };

      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => [data.data, ...prev]);
        setForm(initialForm);
        setSuccess("Review added");
      } else {
        setError(data.error || "Failed to add review");
      }
    } catch {
      setError("Failed to add review");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: Review) => {
    setEditingId(row.id);
    setEditForm({
      authorName: row.authorName,
      authorAvatarUrl: row.authorAvatarUrl || "",
      content: row.content,
      rating: row.rating || 5,
      isVisible: row.isVisible,
      source: row.source || "MANUAL",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    clearMessages();
    try {
      const payload = {
        authorName: editForm.authorName.trim(),
        authorAvatarUrl: editForm.authorAvatarUrl.trim() || null,
        content: editForm.content.trim(),
        rating: editForm.rating >= 1 && editForm.rating <= 5 ? editForm.rating : null,
        isVisible: editForm.isVisible,
        source: editForm.source.trim() || "MANUAL",
      };
      const res = await fetch(`/api/admin/reviews/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => prev.map((r) => (r.id === editingId ? data.data : r)));
        setEditingId(null);
        setSuccess("Review updated");
      } else {
        setError(data.error || "Failed to update review");
      }
    } catch {
      setError("Failed to update review");
    }
  };

  const removeReview = async (id: string) => {
    clearMessages();
    if (!confirm("Delete this review?")) return;
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setSuccess("Review deleted");
      } else {
        setError(data.error || "Failed to delete review");
      }
    } catch {
      setError("Failed to delete review");
    }
  };

  const toggleVisibility = async (row: Review) => {
    clearMessages();
    try {
      const res = await fetch(`/api/admin/reviews/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isVisible: !row.isVisible }),
      });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? data.data : r)));
      } else {
        setError(data.error || "Failed to update visibility");
      }
    } catch {
      setError("Failed to update visibility");
    }
  };

  return (
    <div className="space-y-6">
      <Topbar title="Reviews" description={`Manage manual reviews. Visible: ${totalVisible}/${rows.length}`} />

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{success}</div>}

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add Review</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Author Name *</label>
            <input
              value={form.authorName}
              onChange={(e) => setForm((p) => ({ ...p, authorName: e.target.value }))}
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="username"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Avatar URL</label>
            <input
              value={form.authorAvatarUrl}
              onChange={(e) => setForm((p) => ({ ...p, authorAvatarUrl: e.target.value }))}
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Source</label>
            <input
              value={form.source}
              onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="MANUAL"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Rating (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={form.rating}
              onChange={(e) => setForm((p) => ({ ...p, rating: Number(e.target.value) }))}
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">Content *</label>
          <textarea
            rows={4}
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            className="w-full rounded-lg bg-background border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Review text..."
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isVisible}
            onChange={(e) => setForm((p) => ({ ...p, isVisible: e.target.checked }))}
          />
          Visible on public site
        </label>

        <div className="flex justify-end">
          <button
            onClick={createReview}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Adding..." : "Add Review"}
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">All Reviews ({rows.length})</h2>
          <button onClick={load} className="text-sm text-muted-foreground hover:text-foreground">Refresh</button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No reviews yet.</div>
        ) : (
          <div className="divide-y">
            {rows.map((row) => (
              <div key={row.id} className="p-4 md:p-6 space-y-3">
                {editingId === row.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input value={editForm.authorName} onChange={(e) => setEditForm((p) => ({ ...p, authorName: e.target.value }))} className="rounded-lg bg-background border px-3 py-2 text-sm" />
                      <input value={editForm.authorAvatarUrl} onChange={(e) => setEditForm((p) => ({ ...p, authorAvatarUrl: e.target.value }))} className="rounded-lg bg-background border px-3 py-2 text-sm" />
                      <input value={editForm.source} onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))} className="rounded-lg bg-background border px-3 py-2 text-sm" />
                      <input type="number" min={1} max={5} value={editForm.rating} onChange={(e) => setEditForm((p) => ({ ...p, rating: Number(e.target.value) }))} className="rounded-lg bg-background border px-3 py-2 text-sm" />
                    </div>
                    <textarea rows={3} value={editForm.content} onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))} className="w-full rounded-lg bg-background border px-3 py-2 text-sm" />
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editForm.isVisible} onChange={(e) => setEditForm((p) => ({ ...p, isVisible: e.target.checked }))} />
                      Visible
                    </label>
                    <div className="flex items-center gap-2">
                      <button onClick={saveEdit} className="inline-flex items-center gap-1 rounded-lg bg-green-600/20 px-3 py-1.5 text-sm text-green-400 hover:bg-green-600/30"><Save className="h-4 w-4" />Save</button>
                      <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg bg-gray-500/20 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-500/30"><X className="h-4 w-4" />Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{row.authorName}</span>
                        <span className="text-xs rounded bg-muted px-2 py-0.5">{row.source}</span>
                        <span className={`text-xs rounded px-2 py-0.5 ${row.isVisible ? "bg-green-500/10 text-green-400" : "bg-zinc-500/20 text-zinc-300"}`}>
                          {row.isVisible ? "Visible" : "Hidden"}
                        </span>
                        {row.rating ? <span className="text-xs text-amber-400">{"★".repeat(Math.min(row.rating, 5))}</span> : null}
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{row.content}</p>
                      <p className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("en-US")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleVisibility(row)} className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Toggle visibility">
                        {row.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => startEdit(row)} className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeReview(row.id)} className="p-2 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400" title="Delete">
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

