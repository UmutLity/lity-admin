"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, MoreHorizontal, Pencil, Trash2, Newspaper, Search, ExternalLink, Copy } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function BlogPage() {
  const { addToast } = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPosts = async () => {
    try {
      const res = await fetch("/api/admin/blog");
      const data = await res.json();
      setPosts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const statusOk =
        status === "ALL"
          ? true
          : status === "DRAFT"
            ? !!post.isDraft
            : !post.isDraft;
      const text = `${post.title || ""} ${post.slug || ""} ${post.authorName || ""}`.toLowerCase();
      const queryOk = q ? text.includes(q) : true;
      return statusOk && queryOk;
    });
  }, [posts, query, status]);

  const publishedCount = posts.filter((p) => !p.isDraft).length;
  const draftCount = posts.filter((p) => !!p.isDraft).length;

  const copyPublicLink = async (slug: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/blog/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast({ type: "success", title: "Copied", description: "Public blog URL copied." });
    } catch {
      addToast({ type: "error", title: "Copy failed", description: "Could not copy URL." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted" });
        loadPosts();
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div>
      <Topbar title="Blog" description="Manage public blog articles">
        <Link href="/admin/blog/new">
          <Button>
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </Topbar>

      {loading ? (
        <Card className="p-8">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState icon={Newspaper} title="No blog posts yet" description="Create your first blog post">
            <Link href="/admin/blog/new">
              <Button>
                <Plus className="h-4 w-4" /> New Post
              </Button>
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Posts</p>
              <p className="mt-1 text-2xl font-bold">{posts.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Published</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{publishedCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Draft</p>
              <p className="mt-1 text-2xl font-bold text-amber-300">{draftCount}</p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, slug, author..."
                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/50"
                />
              </label>

              <div className="flex items-center gap-2">
                <Button size="sm" variant={status === "ALL" ? "default" : "outline"} onClick={() => setStatus("ALL")}>All</Button>
                <Button size="sm" variant={status === "PUBLISHED" ? "default" : "outline"} onClick={() => setStatus("PUBLISHED")}>Published</Button>
                <Button size="sm" variant={status === "DRAFT" ? "default" : "outline"} onClick={() => setStatus("DRAFT")}>Draft</Button>
              </div>
            </div>
          </Card>

          <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-0.5">
                      <div>{post.title}</div>
                      <div className="text-xs text-muted-foreground">/{post.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{post.authorName || "-"}</Badge>
                  </TableCell>
                  <TableCell>{post.isDraft ? <Badge variant="outline">Draft</Badge> : <Badge variant="success">Published</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(post.publishedAt || post.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/blog/${post.id}/edit`} className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        {!post.isDraft && (
                          <>
                            <DropdownMenuItem asChild>
                              <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" /> Open Public
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyPublicLink(post.slug)}>
                              <Copy className="mr-2 h-4 w-4" /> Copy URL
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(post.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Card>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Blog Post</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
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
