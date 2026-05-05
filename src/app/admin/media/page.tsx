"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Topbar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { parseVideoUrl } from "@/lib/media-embed";
import { Copy, ExternalLink, Film, Pencil, Plus, Search, Trash2, Tv2 } from "lucide-react";

type VideoItem = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnail: string | null;
  createdAt: string;
  viewCount: number;
  owner: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

type FormState = {
  title: string;
  videoUrl: string;
  thumbnail: string;
};

const defaultForm: FormState = {
  title: "",
  videoUrl: "",
  thumbnail: "",
};

export default function AdminMediaPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const role = ((session?.user as any)?.role || "").toUpperCase();
  const canManage = role === "ADMIN" || role === "FOUNDER" || role === "MEDIA";

  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("ALL");

  const preview = useMemo(() => parseVideoUrl(form.videoUrl), [form.videoUrl]);
  const mediaStats = useMemo(() => {
    const providers = items.reduce<Record<string, number>>((acc, item) => {
      const provider = parseVideoUrl(item.videoUrl)?.provider || "Other";
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});
    const views = items.reduce((acc, item) => acc + Number(item.viewCount || 0), 0);
    return { providers, views };
  }, [items]);
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const provider = parseVideoUrl(item.videoUrl)?.provider || "Other";
      if (providerFilter !== "ALL" && provider !== providerFilter) return false;
      if (q && !`${item.title} ${item.owner?.name || ""} ${provider}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, providerFilter, search]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/videos", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load videos");
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch (error: any) {
      addToast({ type: "error", title: "Media load failed", description: error?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    loadItems();
  }, [canManage]);

  function resetForm() {
    setForm(defaultForm);
    setEditing(null);
  }

  async function submitForm() {
    const title = form.title.trim();
    const videoUrl = form.videoUrl.trim();
    if (!title || !videoUrl) {
      addToast({ type: "error", title: "Title and URL are required" });
      return;
    }

    const parsed = parseVideoUrl(videoUrl);
    if (!parsed) {
      addToast({ type: "error", title: "Only YouTube, Streamable, Vimeo links are supported." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        videoUrl,
        thumbnail: form.thumbnail.trim() || parsed.thumbnail || "",
      };
      const endpoint = editing ? `/api/admin/videos/${editing.id}` : "/api/admin/videos";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      addToast({
        type: "success",
        title: editing ? "Video updated" : "Video published",
        description: editing ? "Changes saved." : "Video is now visible on public media page.",
      });
      resetForm();
      await loadItems();
    } catch (error: any) {
      addToast({ type: "error", title: "Save failed", description: error?.message || "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/admin/videos/${deletingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      addToast({ type: "success", title: "Video deleted" });
      await loadItems();
    } catch (error: any) {
      addToast({ type: "error", title: "Delete failed", description: error?.message || "Unknown error" });
    } finally {
      setDeletingId(null);
      setDeleteOpen(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      addToast({ type: "success", title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      addToast({ type: "error", title: "Copy failed", description: "Clipboard access was not available." });
    }
  }

  if (!canManage) {
    return (
      <Card className="border-white/10 bg-[#16161d]">
        <CardContent className="p-10 text-center">
          <p className="text-lg font-semibold text-white">Access restricted</p>
          <p className="mt-2 text-sm text-zinc-400">Only MEDIA and ADMIN roles can manage videos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Topbar title="Media System" description="Upload links from YouTube, Streamable, or Vimeo and manage showcase videos." />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-white/10 bg-[#14141b]">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Videos</p>
            <p className="mt-2 text-2xl font-bold text-white">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#14141b]">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Total views</p>
            <p className="mt-2 text-2xl font-bold text-white">{mediaStats.views}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#14141b]">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Sources</p>
            <p className="mt-2 text-sm font-semibold text-zinc-200">{Object.keys(mediaStats.providers).join(", ") || "No sources"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/10 bg-[linear-gradient(180deg,#171720,#12121a)]">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-white">
            <Tv2 className="h-4 w-4 text-[#d2b8ff]" />
            <h3 className="text-base font-semibold">{editing ? "Edit video" : "New video"}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">Video title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Example: Valorant Setup Guide"
                className="border-white/10 bg-[#0f0f15] text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Video URL</Label>
              <Input
                value={form.videoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, videoUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                className="border-white/10 bg-[#0f0f15] text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-zinc-300">Custom thumbnail (optional)</Label>
              <Input
                value={form.thumbnail}
                onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                placeholder="https://cdn.example.com/thumb.jpg"
                className="border-white/10 bg-[#0f0f15] text-white placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Embed preview</p>
            {preview ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">
                  Provider: <span className="font-semibold text-white">{preview.provider}</span>
                </p>
                <div className="overflow-hidden rounded-lg border border-fuchsia-400/20 bg-[#0d0d14]">
                  <iframe
                    title="Video preview"
                    src={preview.embedUrl}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="h-56 w-full"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Paste a supported link to preview the embed player.</p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={submitForm} loading={saving} className="bg-[#a78bfa] text-black hover:bg-[#b89dff]">
              <Plus className="mr-1 h-4 w-4" />
              {editing ? "Save changes" : "Publish video"}
            </Button>
            {editing ? (
              <Button
                variant="outline"
                onClick={resetForm}
                className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#14141b]">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Published videos</h3>
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-200">
              {filteredItems.length} shown
            </span>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos, owner or provider..."
                className="border-white/10 bg-[#0f0f15] pl-10 text-white placeholder:text-zinc-500"
              />
            </div>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#0f0f15] px-3 text-sm text-zinc-200 outline-none"
            >
              <option value="ALL">All providers</option>
              {Object.keys(mediaStats.providers).map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-56 animate-pulse rounded-xl border border-white/10 bg-[#0f0f15]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-[#111118] p-10 text-center">
              <Film className="mx-auto h-8 w-8 text-zinc-500" />
              <p className="mt-3 text-sm text-zinc-400">{items.length ? "No videos match this filter." : "No videos yet. Publish your first media post above."}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const parsed = parseVideoUrl(item.videoUrl);
                return (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#181824,#111119)] shadow-[0_14px_40px_rgba(0,0,0,.35)] transition hover:border-fuchsia-400/35"
                  >
                    <div className="relative h-44 overflow-hidden border-b border-white/10 bg-[#0d0d13]">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          <Film className="h-8 w-8" />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded-full border border-fuchsia-300/30 bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia-100">
                        {parsed?.provider || "video"}
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">by {item.owner?.name || "Unknown"}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>{item.viewCount} views</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                          onClick={() => copyText(item.videoUrl, "Video URL")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                          onClick={() => window.open(item.videoUrl, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                          onClick={() => {
                            setEditing(item);
                            setForm({
                              title: item.title,
                              videoUrl: item.videoUrl,
                              thumbnail: item.thumbnail || "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 bg-red-500/20 text-red-200 hover:bg-red-500/30"
                          onClick={() => {
                            setDeletingId(item.id);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-white/10 bg-[#15151e] text-white">
          <DialogHeader>
            <DialogTitle>Delete video</DialogTitle>
            <DialogDescription className="text-zinc-400">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-white/15 bg-transparent text-zinc-200">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
