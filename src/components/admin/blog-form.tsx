"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import { ImagePlus, Upload } from "lucide-react";

interface BlogFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export function BlogForm({ initialData, isEditing }: BlogFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    coverImageUrl: initialData?.coverImageUrl || "",
    authorName: initialData?.authorName || "",
    isDraft: initialData?.isDraft ?? true,
  });

  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!isEditing && !form.authorName) {
      fetch("/api/auth/session")
        .then((r) => r.json())
        .then((s) => {
          const name = s?.user?.name;
          if (name) setForm((prev) => ({ ...prev, authorName: name }));
        })
        .catch(() => {});
    }
  }, [isEditing, form.authorName]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleTitleBlur = () => {
    if (!form.slug.trim() && form.title.trim()) {
      updateField("slug", slugify(form.title));
    }
  };

  const handleUploadCover = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({ type: "error", title: "Upload Failed", description: data.error || "Could not upload image." });
        return;
      }
      updateField("coverImageUrl", data.data.url);
      addToast({ type: "success", title: "Uploaded", description: "Cover image uploaded." });
    } catch {
      addToast({ type: "error", title: "Upload Failed", description: "Unexpected upload error." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const payload = {
        ...form,
        slug: slugify(form.slug || form.title),
      };

      const res = await fetch(isEditing ? `/api/admin/blog/${initialData.id}` : "/api/admin/blog", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        addToast({ type: "error", title: "Error", description: data.error || "Could not save post." });
        return;
      }

      addToast({ type: "success", title: isEditing ? "Updated" : "Created", description: "Blog post saved." });
      router.push("/admin/blog");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "Error", description: "Unexpected error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Blog Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => updateField("title", e.target.value)} onBlur={handleTitleBlur} placeholder="What Is a Spoofer? The Ultimate 2026 Guide" />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input id="slug" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="what-is-a-spoofer-the-ultimate-2026-guide" />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea id="excerpt" rows={3} value={form.excerpt} onChange={(e) => updateField("excerpt", e.target.value)} placeholder="Short summary shown on blog cards..." />
                {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Body (Markdown) *</Label>
                <Textarea
                  id="content"
                  rows={18}
                  className="font-mono text-sm"
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder={"## Intro\nWrite your post with markdown...\n\n- Bullet points\n- Images via URL"}
                />
                <p className="text-xs text-muted-foreground">Word count: {wordCount}</p>
                {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="authorName">Author *</Label>
                <Input id="authorName" value={form.authorName} onChange={(e) => updateField("authorName", e.target.value)} placeholder="Lity Team" />
                {errors.authorName && <p className="text-sm text-destructive">{errors.authorName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverImageUrl">Cover Image URL</Label>
                <Input
                  id="coverImageUrl"
                  value={form.coverImageUrl}
                  onChange={(e) => updateField("coverImageUrl", e.target.value)}
                  placeholder="/uploads/abc.png"
                />
                {errors.coverImageUrl && <p className="text-sm text-destructive">{errors.coverImageUrl}</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCover(file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                  {uploading ? <Upload className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />} Upload Cover
                </Button>
                {form.coverImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.coverImageUrl} alt="Cover preview" className="h-36 w-full object-cover" />
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isDraft">Draft</Label>
                <Switch id="isDraft" checked={form.isDraft} onCheckedChange={(value) => updateField("isDraft", value)} />
              </div>
              {!form.isDraft && <p className="text-xs text-muted-foreground">This post will be publicly visible.</p>}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={loading}>
              {isEditing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
