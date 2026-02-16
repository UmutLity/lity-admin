"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Plus, Trash2, Edit2, Save, X, Package } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#7c3aed");
  const [newIcon, setNewIcon] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, color: newColor, icon: newIcon || null }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName("");
        setNewColor("#7c3aed");
        setNewIcon("");
        setSuccess("Category created successfully");
        fetchCategories();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch {
      setError("Server error");
    }
  };

  const handleUpdate = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, color: editColor, icon: editIcon || null }),
      });
      const data = await res.json();
      if (data.success) {
        setEditId(null);
        setSuccess("Category updated successfully");
        fetchCategories();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update");
      }
    } catch {
      setError("Server error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Products using it must be reassigned first.`)) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSuccess("Category deleted");
        fetchCategories();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Server error");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchCategories();
    } catch {}
  };

  const startEdit = (cat: Category) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditIcon(cat.icon || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" /> Categories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage product categories</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Create new category */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Add New Category</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-muted-foreground block mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. VALORANT"
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="w-[140px]">
            <label className="text-sm text-muted-foreground block mb-1">Icon (emoji/FA)</label>
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="🎮 or fa-gamepad"
              className="w-full rounded-lg bg-background border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <div className="w-[100px]">
            <label className="text-sm text-muted-foreground block mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <span className="text-xs text-muted-foreground">{newColor}</span>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Categories list */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Color</th>
              <th className="text-center px-4 py-3 font-medium">Products</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No categories yet. Create one above.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {editId === cat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded bg-background border px-2 py-1 text-sm w-40 outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="text"
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          placeholder="icon"
                          className="rounded bg-background border px-2 py-1 text-sm w-24 outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.icon || "📦"}</span>
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">({cat.slug})</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === cat.id ? (
                      <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-muted-foreground">{cat.color}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                      <Package className="h-3 w-3" /> {cat.productCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(cat.id, cat.isActive)}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${cat.isActive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editId === cat.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleUpdate(cat.id)} className="p-1.5 rounded hover:bg-green-500/10 text-green-400">
                          <Save className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(cat)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
