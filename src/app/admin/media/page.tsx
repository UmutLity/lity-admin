"use client";

import { useEffect, useState, useRef } from "react";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Upload, Trash2, Image as ImageIcon, Copy, Link, Package, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
}

export default function MediaPage() {
  const { addToast } = useToast();
  const [media, setMedia] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product assignment dialog
  const [assignDialog, setAssignDialog] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ id: string; url: string; filename: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [isThumbnail, setIsThumbnail] = useState(false);

  const loadMedia = async () => {
    try {
      const res = await fetch("/api/admin/media");
      const data = await res.json();
      setMedia(data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/admin/products", { credentials: "include" });
      const data = await res.json();
      setProducts(data.data || []);
    } catch {}
  };

  useEffect(() => {
    loadMedia();
    loadProducts();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/media", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        addToast({ type: "success", title: "Uploaded", description: file.name });
        loadMedia();

        // Open product assignment dialog
        setPendingMedia({ id: data.data.id, url: data.data.url, filename: data.data.filename });
        setSelectedProduct("");
        setIsThumbnail(false);
        setAssignDialog(true);
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch (error) {
      addToast({ type: "error", title: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAssignToProduct = async () => {
    if (!selectedProduct || !pendingMedia) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/products/${selectedProduct}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: pendingMedia.url,
          altText: pendingMedia.filename,
          isThumbnail,
          order: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: "success", title: "Added to product gallery", description: `Image added to product gallery` });
      } else {
        addToast({ type: "error", title: "Error", description: data.error || "Failed to assign" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to assign image" });
    } finally {
      setAssigning(false);
      setAssignDialog(false);
      setPendingMedia(null);
    }
  };

  const handleAssignExisting = (item: any) => {
    setPendingMedia({ id: item.id, url: item.url, filename: item.filename });
    setSelectedProduct("");
    setIsThumbnail(false);
    setAssignDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/media/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted" });
        loadMedia();
      } else {
        const data = await res.json();
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch (error) {
      addToast({ type: "error", title: "Error" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast({ type: "info", title: "Copied", description: "URL copied to clipboard" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div>
      <Topbar title="Media Library" description="Upload and manage images. Assign them to products.">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
          <Upload className="h-4 w-4" /> Upload Image
        </Button>
      </Topbar>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : media.length === 0 ? (
        <Card>
          <EmptyState icon={ImageIcon} title="No media yet" description="Upload images to get started">
            <Button onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload Image</Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <Card key={item.id} className="group overflow-hidden">
              <div className="aspect-square bg-muted relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => handleAssignExisting(item)} title="Assign to Product">
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => copyUrl(item.url)} title="Copy URL">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => setDeleteId(item.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="text-xs font-medium truncate">{item.filename}</p>
                <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>This image will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Product Dialog */}
      <Dialog open={assignDialog} onOpenChange={(open) => { if (!open) { setAssignDialog(false); setPendingMedia(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link className="h-5 w-5" /> Assign to Product</DialogTitle>
            <DialogDescription>Choose which product this image belongs to. It will appear in the product&apos;s detail page gallery.</DialogDescription>
          </DialogHeader>

          {pendingMedia && (
            <div className="flex gap-3 items-center p-3 rounded-lg bg-muted/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingMedia.url} alt="" className="w-16 h-16 rounded-md object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pendingMedia.filename}</p>
                <p className="text-xs text-muted-foreground truncate">{pendingMedia.url}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Select Product</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">-- Select a product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isThumbnail}
                onChange={(e) => setIsThumbnail(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600"
              />
              <span className="text-sm">Set as product thumbnail</span>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAssignDialog(false); setPendingMedia(null); }}>
              Skip
            </Button>
            <Button onClick={handleAssignToProduct} disabled={!selectedProduct} loading={assigning}>
              <Package className="h-4 w-4" /> Add to Gallery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
